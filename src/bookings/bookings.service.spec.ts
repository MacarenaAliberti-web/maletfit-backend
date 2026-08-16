import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma/prisma.service';
import { BadRequestException } from '@nestjs/common';

describe('BookingsService - Concurrency & Capacity Limits', () => {
    let service: BookingsService;
    let transactionQueue: Promise<any>;

    const mockPrismaService = {
        // Simula la cola secuencial de transacciones de la base de datos
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
            create: jest.fn(),
        },
    };

    beforeEach(async () => {
        transactionQueue = Promise.resolve();

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                BookingsService,
                {
                    provide: PrismaService,
                    useValue: mockPrismaService,
                },
            ],
        }).compile();

        service = module.get<BookingsService>(BookingsService);
        jest.clearAllMocks();
    });

    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });

    it('debe rechazar la reserva si la capacidad máxima (5) está alcanzada', async () => {
        mockPrismaService.schedule.findUnique.mockResolvedValue({
            id: 'schedule-1',
            capacity: 5,
            status: 'SCHEDULED',
        } as never);

        mockPrismaService.booking.count.mockResolvedValue(5 as never);

        await expect(
            service.create('user-100', { scheduleId: 'schedule-1' }),
        ).rejects.toThrow(BadRequestException);
    });

    it('debe manejar solicitudes concurrentes respetando el límite de 5 cupos', async () => {
        mockPrismaService.schedule.findUnique.mockResolvedValue({
            id: 'schedule-1',
            capacity: 5,
            status: 'SCHEDULED',
        } as never);

        let currentBookingsCount = 0;

        mockPrismaService.booking.count.mockImplementation(async () => {
            return currentBookingsCount;
        });

        mockPrismaService.booking.findUnique.mockResolvedValue(null as never);

        mockPrismaService.booking.create.mockImplementation(async (args: any) => {
            currentBookingsCount++;
            return { id: `booking-${currentBookingsCount}`, ...args.data };
        });

        const userIds = Array.from({ length: 8 }, (_, i) => `user-${i + 1}`);

        const results = await Promise.allSettled(
            userIds.map((userId) =>
                service.create(userId, { scheduleId: 'schedule-1' }),
            ),
        );

        const successful = results.filter((r) => r.status === 'fulfilled');
        const rejected = results.filter((r) => r.status === 'rejected');

        expect(successful.length).toBe(5);
        expect(rejected.length).toBe(3);
    });
});