import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';

@Injectable()
export class RoutinesService {
    constructor(private readonly prisma: PrismaService) { }

    async create(dto: CreateRoutineDto) {
        return this.prisma.routine.create({
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

        // Si vienen ejercicios nuevos, reemplazamos todos los existentes
        // (más simple y predecible que intentar hacer un diff campo a campo)
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

        // onDelete: Cascade en el schema borra los RoutineExercise automáticamente
        return this.prisma.routine.delete({ where: { id: routineId } });
    }
}