import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ForbiddenException } from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RoutinesService', () => {
    let service: RoutinesService;

    const mockPrismaService = {
        routine: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
            update: jest.fn(),
            delete: jest.fn(),
        },
        routineExercise: {
            deleteMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                RoutinesService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<RoutinesService>(RoutinesService);
        jest.clearAllMocks();
    });

    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('debe crear la rutina con sus ejercicios anidados, asignando orderIndex si no viene', async () => {
            const dto = {
                userId: 'user-1',
                title: 'Rutina de fuerza',
                notes: 'Tren superior',
                exercises: [
                    { name: 'Press de banca', sets: 4, reps: 10, weightKg: 40 },
                    { name: 'Remo con barra', sets: 4, reps: 12 },
                ],
            };

            mockPrismaService.routine.create.mockResolvedValue({ id: 'routine-1', ...dto } as never);

            await service.create(dto);

            expect(mockPrismaService.routine.create).toHaveBeenCalledWith({
                data: {
                    title: dto.title,
                    notes: dto.notes,
                    userId: dto.userId,
                    exercises: {
                        create: [
                            {
                                name: 'Press de banca',
                                sets: 4,
                                reps: 10,
                                weightKg: 40,
                                orderIndex: 0,
                            },
                            {
                                name: 'Remo con barra',
                                sets: 4,
                                reps: 12,
                                weightKg: undefined,
                                orderIndex: 1,
                            },
                        ],
                    },
                },
                include: { exercises: true },
            });
        });

        it('debe respetar el orderIndex explícito si viene en el DTO', async () => {
            const dto = {
                userId: 'user-1',
                title: 'Rutina',
                exercises: [{ name: 'Plancha', sets: 3, reps: 1, orderIndex: 5 }],
            };
            mockPrismaService.routine.create.mockResolvedValue({} as never);

            await service.create(dto);

            const callArg = mockPrismaService.routine.create.mock.calls[0][0] as any;
            expect(callArg.data.exercises.create[0].orderIndex).toBe(5);
        });
    });

    describe('findMyRoutines', () => {
        it('debe devolver las rutinas del usuario ordenadas por fecha de creación descendente', async () => {
            mockPrismaService.routine.findMany.mockResolvedValue([] as never);

            await service.findMyRoutines('user-1');

            expect(mockPrismaService.routine.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1' },
                    orderBy: { createdAt: 'desc' },
                }),
            );
        });
    });

    describe('findOne', () => {
        it('debe lanzar NotFoundException si la rutina no existe', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue(null as never);

            await expect(
                service.findOne('routine-inexistente', 'user-1', 'STUDENT'),
            ).rejects.toThrow(NotFoundException);
        });

        it('debe permitir al dueño ver su propia rutina', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue({
                id: 'routine-1',
                userId: 'user-1',
                exercises: [],
            } as never);

            const result = await service.findOne('routine-1', 'user-1', 'STUDENT');

            expect(result).toBeDefined();
        });

        it('debe permitir a un ADMIN ver la rutina de cualquier alumno', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue({
                id: 'routine-1',
                userId: 'otro-user',
                exercises: [],
            } as never);

            const result = await service.findOne('routine-1', 'admin-1', 'ADMIN');

            expect(result).toBeDefined();
        });

        it('debe permitir a un INSTRUCTOR ver la rutina de cualquier alumno', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue({
                id: 'routine-1',
                userId: 'otro-user',
                exercises: [],
            } as never);

            const result = await service.findOne('routine-1', 'instructor-1', 'INSTRUCTOR');

            expect(result).toBeDefined();
        });

        it('debe lanzar ForbiddenException si un alumno intenta ver la rutina de otro alumno', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue({
                id: 'routine-1',
                userId: 'otro-user',
                exercises: [],
            } as never);

            await expect(
                service.findOne('routine-1', 'user-1', 'STUDENT'),
            ).rejects.toThrow(ForbiddenException);
        });
    });

    describe('update', () => {
        it('debe lanzar NotFoundException si la rutina no existe', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue(null as never);

            await expect(
                service.update('routine-inexistente', { title: 'Nuevo título' }),
            ).rejects.toThrow(NotFoundException);
        });

        it('no debe borrar ni recrear ejercicios si el update no incluye exercises', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue({ id: 'routine-1' } as never);
            mockPrismaService.routine.update.mockResolvedValue({} as never);

            await service.update('routine-1', { title: 'Solo cambio el título' });

            expect(mockPrismaService.routineExercise.deleteMany).not.toHaveBeenCalled();
        });

        it('debe borrar los ejercicios existentes y recrearlos si vienen exercises en el update', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue({ id: 'routine-1' } as never);
            mockPrismaService.routine.update.mockResolvedValue({} as never);

            await service.update('routine-1', {
                exercises: [{ name: 'Sentadilla', sets: 4, reps: 8 }],
            });

            expect(mockPrismaService.routineExercise.deleteMany).toHaveBeenCalledWith({
                where: { routineId: 'routine-1' },
            });
            expect(mockPrismaService.routine.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        exercises: {
                            create: [
                                { name: 'Sentadilla', sets: 4, reps: 8, weightKg: undefined, orderIndex: 0 },
                            ],
                        },
                    }),
                }),
            );
        });
    });

    describe('remove', () => {
        it('debe lanzar NotFoundException si la rutina no existe', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue(null as never);

            await expect(service.remove('routine-inexistente')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('debe eliminar la rutina si existe', async () => {
            mockPrismaService.routine.findUnique.mockResolvedValue({ id: 'routine-1' } as never);
            mockPrismaService.routine.delete.mockResolvedValue({} as never);

            await service.remove('routine-1');

            expect(mockPrismaService.routine.delete).toHaveBeenCalledWith({
                where: { id: 'routine-1' },
            });
        });
    });
});