import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';

@Injectable()
export class RoutinesService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly mailService: MailService,
    ) { }

    async create(dto: CreateRoutineDto) {
        const routine = await this.prisma.routine.create({
            data: {
                title: dto.title,
                notes: dto.notes,
                userId: dto.userId,
                exercises: {
                    create: dto.exercises.map((exercise, index) => ({
                        name: exercise.name,
                        sets: exercise.sets,
                        reps: exercise.reps,
                        weightKg: exercise.weightKg,
                        orderIndex: exercise.orderIndex ?? index,
                    })),
                },
            },
            include: { exercises: true },
        });

        void this.notifyRoutineAssigned(dto.userId, routine.title);

        return routine;
    }

    private async notifyRoutineAssigned(userId: string, routineTitle: string) {
        try {
            const user = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { email: true, fullName: true },
            });

            if (!user) return;

            await this.mailService.sendRoutineAssignedEmail(
                user.email,
                user.fullName,
                routineTitle,
            );
        } catch {
            // No debe afectar la respuesta ya enviada.
        }
    }

    async findMyRoutines(userId: string) {
        return this.prisma.routine.findMany({
            where: { userId },
            include: {
                exercises: {
                    orderBy: { orderIndex: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async findOne(routineId: string, requesterId: string, requesterRole: string) {
        const routine = await this.prisma.routine.findUnique({
            where: { id: routineId },
            include: {
                exercises: { orderBy: { orderIndex: 'asc' } },
            },
        });

        if (!routine) {
            throw new NotFoundException('Rutina no encontrada');
        }

        const isOwner = routine.userId === requesterId;
        const isStaff = requesterRole === 'ADMIN' || requesterRole === 'INSTRUCTOR';

        if (!isOwner && !isStaff) {
            throw new ForbiddenException('No tienes permiso para ver esta rutina');
        }

        return routine;
    }

    async findAll() {
        return this.prisma.routine.findMany({
            include: {
                user: {
                    select: { id: true, fullName: true, email: true },
                },
                exercises: {
                    orderBy: { orderIndex: 'asc' },
                },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async update(routineId: string, dto: UpdateRoutineDto) {
        const routine = await this.prisma.routine.findUnique({ where: { id: routineId } });

        if (!routine) {
            throw new NotFoundException('Rutina no encontrada');
        }

        if (dto.exercises) {
            await this.prisma.routineExercise.deleteMany({ where: { routineId } });
        }

        return this.prisma.routine.update({
            where: { id: routineId },
            data: {
                title: dto.title,
                notes: dto.notes,
                ...(dto.exercises && {
                    exercises: {
                        create: dto.exercises.map((exercise, index) => ({
                            name: exercise.name,
                            sets: exercise.sets,
                            reps: exercise.reps,
                            weightKg: exercise.weightKg,
                            orderIndex: exercise.orderIndex ?? index,
                        })),
                    },
                }),
            },
            include: { exercises: { orderBy: { orderIndex: 'asc' } } },
        });
    }

    async remove(routineId: string) {
        const routine = await this.prisma.routine.findUnique({ where: { id: routineId } });

        if (!routine) {
            throw new NotFoundException('Rutina no encontrada');
        }

        return this.prisma.routine.delete({ where: { id: routineId } });
    }
}