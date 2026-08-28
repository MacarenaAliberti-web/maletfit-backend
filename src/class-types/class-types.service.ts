import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ClassTypesService {
    constructor(private readonly prisma: PrismaService) { }

    findAll() {
        return this.prisma.classType.findMany();
    }

    create(data: { name: string; description?: string; durationMin?: number }) {
        return this.prisma.classType.create({ data });
    }
}