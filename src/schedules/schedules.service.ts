import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';

@Injectable()
export class SchedulesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateScheduleDto) {
        return this.prisma.schedule.create({
            data: {
                startTime: new Date(dto.startTime),
                endTime: new Date(dto.endTime),
                capacity: dto.capacity ?? 5,
                classTypeId: dto.classTypeId,
                instructorId: dto.instructorId,
            },
        });
    }

    async findAll() {
        return this.prisma.schedule.findMany({
            include: {
                classType: true,
                instructor: {
                    include: {
                        user: {
                            select: { fullName: true, email: true },
                        },
                    },
                },
                _count: {
                    select: { bookings: { where: { status: 'CONFIRMED' } } },
                },
            },
        });
    }

    async findMySchedules(instructorUserId: string) {
        // El modelo Instructor tiene su propio id, distinto del userId del User.
        // Primero resolvemos el Instructor a partir del userId que viene del JWT.
        const instructor = await this.prisma.instructor.findUnique({
            where: { userId: instructorUserId },
        });

        if (!instructor) {
            throw new NotFoundException('No se encontró un perfil de instructor para este usuario');
        }

        return this.prisma.schedule.findMany({
            where: { instructorId: instructor.id },
            include: {
                classType: true,
                _count: {
                    select: { bookings: { where: { status: 'CONFIRMED' } } },
                },
            },
            orderBy: { startTime: 'asc' },
        });
    }

    async getAvailability(id: string) {
        const schedule = await this.prisma.schedule.findUnique({
            where: { id },
            include: {
                _count: {
                    select: { bookings: { where: { status: 'CONFIRMED' } } },
                },
            },
        });

        if (!schedule) {
            throw new NotFoundException('Turno no encontrado');
        }

        const occupied = schedule._count.bookings;
        const available = Math.max(0, schedule.capacity - occupied);

        return {
            scheduleId: schedule.id,
            capacity: schedule.capacity,
            occupiedSeats: occupied,
            availableSeats: available,
            isFull: available === 0,
        };
    }

    async getRoster(scheduleId: string) {
        const schedule = await this.prisma.schedule.findUnique({
            where: { id: scheduleId },
        });

        if (!schedule) {
            throw new NotFoundException('Turno no encontrado');
        }

        const bookings = await this.prisma.booking.findMany({
            where: {
                scheduleId,
                status: { in: ['CONFIRMED', 'WAITLIST', 'ATTENDED', 'NO_SHOW'] },
            },
            include: {
                user: {
                    select: { id: true, fullName: true, email: true },
                },
            },
            orderBy: { createdAt: 'asc' },
        });

        return {
            scheduleId,
            confirmed: bookings.filter((b) =>
                ['CONFIRMED', 'ATTENDED', 'NO_SHOW'].includes(b.status),
            ),
            waitlist: bookings.filter((b) => b.status === 'WAITLIST'),
        };
    }
}