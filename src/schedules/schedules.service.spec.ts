import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SchedulesService', () => {
    let service: SchedulesService;

    const mockPrismaService = {
        schedule: {
            create: jest.fn(),
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
        instructor: {
            findUnique: jest.fn(),
        },
        booking: {
            findMany: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SchedulesService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<SchedulesService>(SchedulesService);
        jest.clearAllMocks();
    });

    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });

    describe('create', () => {
        it('debe crear un turno con los datos convertidos correctamente', async () => {
            const dto = {
                startTime: '2026-09-20T14:00:00.000Z',
                endTime: '2026-09-20T15:00:00.000Z',
                capacity: 5,
                classTypeId: 'class-type-1',
                instructorId: 'instructor-1',
            };

            mockPrismaService.schedule.create.mockResolvedValue({
                id: 'schedule-1',
                ...dto,
            } as never);

            await service.create(dto);

            expect(mockPrismaService.schedule.create).toHaveBeenCalledWith({
                data: {
                    startTime: new Date(dto.startTime),
                    endTime: new Date(dto.endTime),
                    capacity: dto.capacity,
                    classTypeId: dto.classTypeId,
                    instructorId: dto.instructorId,
                },
            });
        });

        it('debe usar capacity 5 por defecto si no se especifica', async () => {
            const dto = {
                startTime: '2026-09-20T14:00:00.000Z',
                endTime: '2026-09-20T15:00:00.000Z',
                classTypeId: 'class-type-1',
                instructorId: 'instructor-1',
            } as any;

            mockPrismaService.schedule.create.mockResolvedValue({} as never);

            await service.create(dto);

            expect(mockPrismaService.schedule.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ capacity: 5 }),
                }),
            );
        });
    });

    describe('findMySchedules', () => {
        it('debe lanzar NotFoundException si el usuario no tiene perfil de instructor', async () => {
            mockPrismaService.instructor.findUnique.mockResolvedValue(null as never);

            await expect(service.findMySchedules('user-sin-perfil')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('debe filtrar los turnos por el instructorId resuelto desde el userId', async () => {
            mockPrismaService.instructor.findUnique.mockResolvedValue({
                id: 'instructor-1',
                userId: 'user-1',
            } as never);
            mockPrismaService.schedule.findMany.mockResolvedValue([] as never);

            await service.findMySchedules('user-1');

            expect(mockPrismaService.instructor.findUnique).toHaveBeenCalledWith({
                where: { userId: 'user-1' },
            });
            expect(mockPrismaService.schedule.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { instructorId: 'instructor-1' },
                }),
            );
        });
    });

    describe('getAvailability', () => {
        it('debe lanzar NotFoundException si el turno no existe', async () => {
            mockPrismaService.schedule.findUnique.mockResolvedValue(null as never);

            await expect(service.getAvailability('schedule-inexistente')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('debe calcular correctamente los cupos disponibles', async () => {
            mockPrismaService.schedule.findUnique.mockResolvedValue({
                id: 'schedule-1',
                capacity: 5,
                _count: { bookings: 3 },
            } as never);

            const result = await service.getAvailability('schedule-1');

            expect(result).toEqual({
                scheduleId: 'schedule-1',
                capacity: 5,
                occupiedSeats: 3,
                availableSeats: 2,
                isFull: false,
            });
        });

        it('debe marcar isFull true y availableSeats en 0 cuando está completo (nunca negativo)', async () => {
            mockPrismaService.schedule.findUnique.mockResolvedValue({
                id: 'schedule-1',
                capacity: 5,
                _count: { bookings: 5 },
            } as never);

            const result = await service.getAvailability('schedule-1');

            expect(result.availableSeats).toBe(0);
            expect(result.isFull).toBe(true);
        });
    });

    describe('getRoster', () => {
        it('debe lanzar NotFoundException si el turno no existe', async () => {
            mockPrismaService.schedule.findUnique.mockResolvedValue(null as never);

            await expect(service.getRoster('schedule-inexistente')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('debe separar correctamente confirmados (incluyendo ATTENDED/NO_SHOW) de la lista de espera', async () => {
            mockPrismaService.schedule.findUnique.mockResolvedValue({
                id: 'schedule-1',
            } as never);

            mockPrismaService.booking.findMany.mockResolvedValue([
                { id: 'b1', status: 'CONFIRMED', user: { fullName: 'Ana' } },
                { id: 'b2', status: 'WAITLIST', user: { fullName: 'Bruno' } },
                { id: 'b3', status: 'ATTENDED', user: { fullName: 'Carla' } },
                { id: 'b4', status: 'NO_SHOW', user: { fullName: 'Diego' } },
            ] as never);

            const result = await service.getRoster('schedule-1');

            expect(result.confirmed.map((b) => b.id)).toEqual(['b1', 'b3', 'b4']);
            expect(result.waitlist.map((b) => b.id)).toEqual(['b2']);
        });
    });
});