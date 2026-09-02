import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { PrismaService } from '../prisma/prisma.service';

describe('InstructorsService', () => {
    let service: InstructorsService;

    const mockPrismaService = {
        instructor: {
            findMany: jest.fn(),
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                InstructorsService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<InstructorsService>(InstructorsService);
        jest.clearAllMocks();
    });

    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('debe devolver todos los instructores con los datos de su usuario incluidos', async () => {
            const mockInstructors = [
                {
                    id: 'instructor-1',
                    bio: null,
                    specialty: 'Funcional',
                    user: { id: 'user-1', fullName: 'Macu Ailen', email: 'macu@maletfit.com' },
                },
            ];
            mockPrismaService.instructor.findMany.mockResolvedValue(mockInstructors as never);

            const result = await service.findAll();

            expect(result).toEqual(mockInstructors);
            expect(mockPrismaService.instructor.findMany).toHaveBeenCalledWith(
                expect.objectContaining({
                    include: expect.objectContaining({
                        user: expect.any(Object),
                    }),
                }),
            );
        });
    });

    describe('findMyProfile', () => {
        it('debe lanzar NotFoundException si el usuario no tiene perfil de instructor', async () => {
            mockPrismaService.instructor.findUnique.mockResolvedValue(null as never);

            await expect(service.findMyProfile('user-sin-perfil')).rejects.toThrow(
                NotFoundException,
            );
        });

        it('debe devolver el perfil de instructor asociado al userId', async () => {
            const mockProfile = {
                id: 'instructor-1',
                bio: null,
                specialty: 'Funcional',
                user: { id: 'user-1', fullName: 'Macu Ailen', email: 'macu@maletfit.com' },
            };
            mockPrismaService.instructor.findUnique.mockResolvedValue(mockProfile as never);

            const result = await service.findMyProfile('user-1');

            expect(result).toEqual(mockProfile);
            expect(mockPrismaService.instructor.findUnique).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { userId: 'user-1' },
                }),
            );
        });
    });
});