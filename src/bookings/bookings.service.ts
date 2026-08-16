import {
    Injectable,
    BadRequestException,
    NotFoundException,
    ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookingDto } from './dto/create-booking.dto';

@Injectable()
export class BookingsService {
    constructor(private readonly prisma: PrismaService) { }

    async create(userId: string, dto: CreateBookingDto) {
        return this.prisma.$transaction(async (tx) => {
            // 1. Obtener el turno
            const schedule = await tx.schedule.findUnique({
                where: { id: dto.scheduleId },
            });

            if (!schedule) {
                throw new NotFoundException('El turno especificado no existe');
            }

            if (schedule.status === 'CANCELLED') {
                throw new BadRequestException('No se puede reservar un turno cancelado');
            }

            // 2. Verificar reservas activas en el turno
            const activeBookingsCount = await tx.booking.count({
                where: {
                    scheduleId: dto.scheduleId,
                    status: 'CONFIRMED',
                },
            });

            if (activeBookingsCount >= schedule.capacity) {
                throw new BadRequestException('El turno ya no tiene cupos disponibles (máximo 5)');
            }

            // 3. Verificar si el alumno ya tiene una reserva activa en este turno
            const existingBooking = await tx.booking.findUnique({
                where: {
                    userId_scheduleId: {
                        userId,
                        scheduleId: dto.scheduleId,
                    },
                },
            });

            if (existingBooking && existingBooking.status === 'CONFIRMED') {
                throw new ConflictException('Ya tienes una reserva activa para este turno');
            }

            // 4. Crear o reactivar la reserva
            if (existingBooking) {
                return tx.booking.update({
                    where: { id: existingBooking.id },
                    data: { status: 'CONFIRMED' },
                });
            }

            return tx.booking.create({
                data: {
                    userId,
                    scheduleId: dto.scheduleId,
                    status: 'CONFIRMED',
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
        const booking = await this.prisma.booking.findUnique({
            where: { id: bookingId },
        });

        if (!booking) {
            throw new NotFoundException('Reserva no encontrada');
        }

        if (booking.userId !== userId) {
            throw new BadRequestException('No tienes permiso para cancelar esta reserva');
        }

        return this.prisma.booking.update({
            where: { id: bookingId },
            data: { status: 'CANCELLED' },
        });
    }
}