import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class BookingsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    private async runSerializableTransaction<T>(
        fn: (tx: Prisma.TransactionClient) => Promise<T>,
    ): Promise<T> {
        const MAX_RETRIES = 2;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
            try {
                return await this.prisma.$transaction(fn, {
                    isolationLevel: 'Serializable',
                    maxWait: 10000,
                    timeout: 15000,
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
        const booking = await this.runSerializableTransaction(async (tx) => {
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

        // El email se dispara DESPUÉS de que la transacción ya se
        // completó con éxito — nunca dentro de ella. Un email es un
        // efecto secundario, no debe formar parte de la atomicidad
        // de la reserva.
        void this.notifyBookingStatus(userId, dto.scheduleId, booking.status);

        return booking;
    }

    private async notifyBookingStatus(
        userId: string,
        scheduleId: string,
        status: string,
    ) {
        try {
            const [user, schedule] = await Promise.all([
                this.prisma.user.findUnique({
                    where: { id: userId },
                    select: { email: true, fullName: true },
                }),
                this.prisma.schedule.findUnique({
                    where: { id: scheduleId },
                    include: { classType: true },
                }),
            ]);

            if (!user || !schedule) return;

            if (status === 'CONFIRMED') {
                await this.mailService.sendBookingConfirmedEmail(
                    user.email,
                    user.fullName,
                    schedule.classType.name,
                    schedule.startTime,
                );
            } else if (status === 'WAITLIST') {
                await this.mailService.sendBookingWaitlistEmail(
                    user.email,
                    user.fullName,
                    schedule.classType.name,
                    schedule.startTime,
                );
            }
        } catch {
            // Si algo falla acá (por ejemplo, una query), no debe
            // afectar la respuesta de la reserva — ya se devolvió
            // exitosamente antes de que esto se ejecute.
        }
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
        const result = await this.runSerializableTransaction(async (tx) => {
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
                return { cancelled: booking, promotedBookingId: null };
            }

            const wasConfirmed = booking.status === 'CONFIRMED';

            const updatedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: { status: 'CANCELLED' },
            });

            let promotedBookingId: string | null = null;

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
                    promotedBookingId = nextInWaitlist.id;
                }
            }

            return { cancelled: updatedBooking, promotedBookingId };
        });

        // Emails después de que la transacción ya se completó con éxito.
        void this.notifyCancellation(result.cancelled.id, userId);
        if (result.promotedBookingId) {
            void this.notifyPromotion(result.promotedBookingId);
        }

        return result.cancelled;
    }

    private async notifyCancellation(bookingId: string, userId: string) {
        try {
            const booking = await this.prisma.booking.findUnique({
                where: { id: bookingId },
                include: { schedule: { include: { classType: true } } },
            });
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, fullName: true },
            });

            if (!booking || !user) return;

            await this.mailService.sendBookingCancelledEmail(
                user.email,
                user.fullName,
                booking.schedule.classType.name,
                booking.schedule.startTime,
            );
        } catch {
            // No debe afectar la respuesta ya enviada.
        }
    }

    private async notifyPromotion(bookingId: string) {
        try {
            const booking = await this.prisma.booking.findUnique({
                where: { id: bookingId },
                include: {
                    schedule: { include: { classType: true } },
                    user: { select: { email: true, fullName: true } },
                },
            });

            if (!booking) return;

            await this.mailService.sendBookingPromotedEmail(
                booking.user.email,
                booking.user.fullName,
                booking.schedule.classType.name,
                booking.schedule.startTime,
            );
        } catch {
            // No debe afectar la respuesta ya enviada.
        }
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