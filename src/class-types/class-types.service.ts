import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateClassTypeDto } from './dto/create-class-type.dto';

@Injectable()
export class ClassTypesService {
    constructor(private readonly prisma: PrismaService) { }

    findAll() {
        return this.prisma.classType.findMany();
    }

    create(data: CreateClassTypeDto) {
        return this.prisma.classType.create({ data });
    }
}