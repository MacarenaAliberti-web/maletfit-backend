import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BookingsService {
    constructor(private readonly prisma: PrismaService) { }

    private async runSerializableTransaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
        const MAX_RETRIES = 2;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.prisma.$transaction(fn, {
                    isolationLevel: 'Serializable',
                    maxWait: 10000, // tiempo esperando para ENTRAR a la transacción
                    timeout: 15000,  // tiempo máximo que puede durar la transacción una vez iniciada
                });
            } catch (error) {
                const isSerializationError =
                    error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';

                if (isSerializationError && attempt < MAX_RETRIES) {
                    continue;
                }
                throw error;
            }
        }

        throw new Error('No se pudo completar la operación tras reintentos');
    }

    async create(userId: string, dto: CreateBookingDto) {
        return this.runSerializableTransaction(async (tx) => {
            const schedule = await tx.schedule.findUnique({
                where: { id: dto.scheduleId },
            });

            if (!schedule) {
                throw new NotFoundException('El turno especificado no existe');
            }

            if (schedule.status === 'CANCELLED') {
                throw new BadRequestException('No se puede reservar un turno cancelado');
            }

            const existingBooking = await tx.booking.findUnique({
                where: {
                    userId_scheduleId: {
                        userId,
                        scheduleId: dto.scheduleId,
                    },
                },
            });

            if (
                existingBooking &&
                (existingBooking.status === 'CONFIRMED' || existingBooking.status === 'WAITLIST')
            ) {
                throw new ConflictException(
                    'Ya tienes una reserva activa o estás en lista de espera para este turno',
                );
            }

            const activeBookingsCount = await tx.booking.count({
                where: {
                    scheduleId: dto.scheduleId,
                    status: 'CONFIRMED',
                },
            });

            const newStatus = activeBookingsCount >= schedule.capacity ? 'WAITLIST' : 'CONFIRMED';

            if (existingBooking) {
                return tx.booking.update({
                    where: { id: existingBooking.id },
                    data: { status: newStatus },
                });
            }

            return tx.booking.create({
                data: {
                    userId,
                    scheduleId: dto.scheduleId,
                    status: newStatus,
                },
            });
        });
    }

    async findMyBookings(userId: string) {
        return this.prisma.booking.findMany({
            where: { userId },
            include: {
                schedule: {
                    include: {
                        classType: true,
                        instructor: {
                            include: {
                                user: { select: { fullName: true } },
                            },
                        },
                    },
                },
            },
        });
    }

    async cancel(userId: string, bookingId: string) {
        return this.runSerializableTransaction(async (tx) => {
            const booking = await tx.booking.findUnique({
                where: { id: bookingId },
            });

            if (!booking) {
                throw new NotFoundException('Reserva no encontrada');
            }

            if (booking.userId !== userId) {
                throw new BadRequestException('No tienes permiso para cancelar esta reserva');
            }

            if (booking.status === 'CANCELLED') {
                return booking;
            }

            const wasConfirmed = booking.status === 'CONFIRMED';

            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'CANCELLED' },
            });

            if (wasConfirmed) {
                const nextInWaitlist = await tx.booking.findFirst({
                    where: {
                        scheduleId: booking.scheduleId,
                        status: 'WAITLIST',
                    },
                    orderBy: {
                        createdAt: 'asc',
                    },
                });

                if (nextInWaitlist) {
                    await tx.booking.update({
                        where: { id: nextInWaitlist.id },
                        data: { status: 'CONFIRMED' },
                    });
                }
            }

            return updatedBooking;
        });
    }

    async updateAttendance(
        instructorId: string,
        bookingId: string,
        status: 'ATTENDED' | 'NO_SHOW',
    ) {
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Reserva no encontrada');
        }

        return this.prisma.booking.update({
            where: { id: bookingId },
            data: { status },
        });
    }
}