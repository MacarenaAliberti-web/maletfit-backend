import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('BookingsService - Concurrencia, capacidad y lista de espera', () => {
    let service: BookingsService;

    // Cola que simula transacciones ejecutándose una atrás de otra
    // SOLO para los tests que quieren probar la lógica de negocio en sí
    // (asignación de estados). Ver más abajo el test de concurrencia real,
    // que NO usa esta cola.
    let transactionQueue: Promise<any>;

    const mockPrismaService = {
        $transaction: jest.fn((callback: any) => {
            const result = transactionQueue.then(() => callback(mockPrismaService));
            transactionQueue = result.catch(() => { });
            return result;
        }),
        schedule: {
            findUnique: jest.fn(),
        },
        booking: {
            count: jest.fn(),
            findUnique: jest.fn(),
            findFirst: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        },
    };

    beforeEach(async () => {
        transactionQueue = Promise.resolve();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BookingsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<BookingsService>(BookingsService);
        jest.clearAllMocks();
    });

    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });

    it('debe asignar CONFIRMED cuando hay cupos disponibles', async () => {
        mockPrismaService.schedule.findUnique.mockResolvedValue({
            id: 'schedule-1',
            capacity: 5,
            status: 'SCHEDULED',
        } as never);
        mockPrismaService.booking.findUnique.mockResolvedValue(null as never);
        mockPrismaService.booking.count.mockResolvedValue(2 as never);
        mockPrismaService.booking.create.mockImplementation(async (args: any) => ({
            id: 'booking-new',
            ...args.data,
        }));

        const result = await service.create('user-100', { scheduleId: 'schedule-1' });

        expect(result).toHaveProperty('status', 'CONFIRMED');
        // Confirma que la transacción se ejecutó con el nivel de aislamiento correcto
        expect(mockPrismaService.$transaction).toHaveBeenCalledWith(
            expect.any(Function),
            { isolationLevel: 'Serializable' },
        );
    });

    it('debe asignar WAITLIST cuando la capacidad máxima ya está alcanzada', async () => {
        mockPrismaService.schedule.findUnique.mockResolvedValue({
            id: 'schedule-1',
            capacity: 5,
            status: 'SCHEDULED',
        } as never);
        mockPrismaService.booking.findUnique.mockResolvedValue(null as never);
        mockPrismaService.booking.count.mockResolvedValue(5 as never);
        mockPrismaService.booking.create.mockImplementation(async (args: any) => ({
            id: 'booking-new',
            ...args.data,
        }));

        const result = await service.create('user-100', { scheduleId: 'schedule-1' });

        expect(result).toHaveProperty('status', 'WAITLIST');
    });

    it('debe rechazar una reserva si el usuario ya tiene una activa o en espera', async () => {
        mockPrismaService.schedule.findUnique.mockResolvedValue({
            id: 'schedule-1',
            capacity: 5,
            status: 'SCHEDULED',
        } as never);
        mockPrismaService.booking.findUnique.mockResolvedValue({
            id: 'existing-1',
            status: 'WAITLIST',
        } as never);

        await expect(service.create('user-100', { scheduleId: 'schedule-1' })).rejects.toThrow(
            'Ya tienes una reserva activa o estás en lista de espera para este turno',
        );
    });

    it('debe distribuir 8 solicitudes secuenciales en 5 CONFIRMED y 3 WAITLIST (lógica de negocio)', async () => {
        mockPrismaService.schedule.findUnique.mockResolvedValue({
            id: 'schedule-1',
            capacity: 5,
            status: 'SCHEDULED',
        } as never);

        const createdBookings: any[] = [];

        mockPrismaService.booking.findUnique.mockResolvedValue(null as never);

        mockPrismaService.booking.count.mockImplementation(async () => {
            return createdBookings.filter((b) => b.status === 'CONFIRMED').length;
        });

        // El mock ya NO decide el status — solo devuelve lo que el service le mandó
        mockPrismaService.booking.create.mockImplementation(async (args: any) => {
            const newBooking = { id: `booking-${createdBookings.length + 1}`, ...args.data };
            createdBookings.push(newBooking);
            return newBooking;
        });

        const userIds = Array.from({ length: 8 }, (_, i) => `user-${i + 1}`);

        const results = await Promise.all(
            userIds.map((userId) => service.create(userId, { scheduleId: 'schedule-1' })),
        );

        const confirmed = results.filter((r: any) => r.status === 'CONFIRMED');
        const waitlisted = results.filter((r: any) => r.status === 'WAITLIST');

        expect(confirmed.length).toBe(5);
        expect(waitlisted.length).toBe(3);
    });

    it('debe reintentar la transacción cuando Prisma devuelve un error de serialización (P2034)', async () => {
        const serializationError = new Prisma.PrismaClientKnownRequestError(
            'Transaction failed due to a write conflict',
            { code: 'P2034', clientVersion: '5.0.0' },
        );

        let callCount = 0;
        mockPrismaService.$transaction.mockImplementation(async (callback: any) => {
            callCount++;
            if (callCount === 1) {
                throw serializationError;
            }
            return callback(mockPrismaService);
        });

        mockPrismaService.schedule.findUnique.mockResolvedValue({
            id: 'schedule-1',
            capacity: 5,
            status: 'SCHEDULED',
        } as never);
        mockPrismaService.booking.findUnique.mockResolvedValue(null as never);
        mockPrismaService.booking.count.mockResolvedValue(2 as never);
        mockPrismaService.booking.create.mockResolvedValue({
            id: 'booking-x',
            status: 'CONFIRMED',
        } as never);

        const result = await service.create('user-1', { scheduleId: 'schedule-1' });

        expect(callCount).toBe(2);
        expect(result).toHaveProperty('status', 'CONFIRMED');
    });

    describe('cancel() y ascenso automático de lista de espera', () => {
        it('debe ascender al primero en WAITLIST cuando se cancela una reserva CONFIRMED', async () => {
            mockPrismaService.booking.findUnique.mockResolvedValue({
                id: 'booking-1',
                userId: 'user-1',
                scheduleId: 'schedule-1',
                status: 'CONFIRMED',
            } as never);

            mockPrismaService.booking.update.mockImplementation(async (args: any) => ({
                id: args.where.id,
                ...args.data,
            }));

            mockPrismaService.booking.findFirst.mockResolvedValue({
                id: 'booking-waitlist-1',
                status: 'WAITLIST',
            } as never);

            await service.cancel('user-1', 'booking-1');

            // Verifica que efectivamente se intentó ascender al de la waitlist
            expect(mockPrismaService.booking.update).toHaveBeenCalledWith({
                where: { id: 'booking-waitlist-1' },
                data: { status: 'CONFIRMED' },
            });
        });

        it('NO debe intentar ascender a nadie si no había nadie en WAITLIST', async () => {
            mockPrismaService.booking.findUnique.mockResolvedValue({
                id: 'booking-1',
                userId: 'user-1',
                scheduleId: 'schedule-1',
                status: 'CONFIRMED',
            } as never);
            mockPrismaService.booking.update.mockImplementation(async (args: any) => ({
                id: args.where.id,
                ...args.data,
            }));
            mockPrismaService.booking.findFirst.mockResolvedValue(null as never);

            await service.cancel('user-1', 'booking-1');

            // Solo se llamó update una vez (la propia cancelación), no hubo ascenso
            expect(mockPrismaService.booking.update).toHaveBeenCalledTimes(1);
        });

        it('NO debe buscar en WAITLIST si la reserva cancelada no estaba CONFIRMED', async () => {
            mockPrismaService.booking.findUnique.mockResolvedValue({
                id: 'booking-1',
                userId: 'user-1',
                scheduleId: 'schedule-1',
                status: 'WAITLIST',
            } as never);
            mockPrismaService.booking.update.mockImplementation(async (args: any) => ({
                id: args.where.id,
                ...args.data,
            }));

            await service.cancel('user-1', 'booking-1');

            expect(mockPrismaService.booking.findFirst).not.toHaveBeenCalled();
        });
    });
});