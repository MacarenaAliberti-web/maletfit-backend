import { describe, it, expect, jest, beforeEach } from '@jest/globals';
import { Test, TestingModule } from '@nestjs/testing';
import { ClassTypesService } from './class-types.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ClassTypesService', () => {
    let service: ClassTypesService;

    const mockPrismaService = {
        classType: {
            findMany: jest.fn(),
            create: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ClassTypesService,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        service = module.get<ClassTypesService>(ClassTypesService);
        jest.clearAllMocks();
    });

    it('debe estar definido', () => {
        expect(service).toBeDefined();
    });

    describe('findAll', () => {
        it('debe devolver la lista de tipos de clase', async () => {
            const mockClassTypes = [
                { id: 'ct-1', name: 'Yoga', description: null, durationMin: 60 },
                { id: 'ct-2', name: 'Crossfit', description: 'Alta intensidad', durationMin: 45 },
            ];
            mockPrismaService.classType.findMany.mockResolvedValue(mockClassTypes as never);

            const result = await service.findAll();

            expect(result).toEqual(mockClassTypes);
            expect(mockPrismaService.classType.findMany).toHaveBeenCalledWith();
        });
    });

    describe('create', () => {
        it('debe crear un tipo de clase con los datos recibidos', async () => {
            const dto = { name: 'Pilates', description: 'Bajo impacto', durationMin: 50 };
            mockPrismaService.classType.create.mockResolvedValue({
                id: 'ct-3',
                ...dto,
            } as never);

            const result = await service.create(dto);

            expect(mockPrismaService.classType.create).toHaveBeenCalledWith({ data: dto });
            expect(result).toEqual({ id: 'ct-3', ...dto });
        });

        it('debe crear un tipo de clase sin description (campo opcional)', async () => {
            const dto = { name: 'Spinning', durationMin: 40 };
            mockPrismaService.classType.create.mockResolvedValue({
                id: 'ct-4',
                ...dto,
            } as never);

            await service.create(dto);

            expect(mockPrismaService.classType.create).toHaveBeenCalledWith({ data: dto });
        });
    });
});