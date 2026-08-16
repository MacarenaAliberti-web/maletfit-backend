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
}