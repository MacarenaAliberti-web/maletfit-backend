import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InstructorsService {
    constructor(private readonly prisma: PrismaService) { }

    async findAll() {
        return this.prisma.instructor.findMany({
            include: {
                user: {
                    select: { id: true, fullName: true, email: true },
                },
            },
        });
    }

    async findMyProfile(userId: string) {
        const instructor = await this.prisma.instructor.findUnique({
            where: { userId },
            include: {
                user: {
                    select: { id: true, fullName: true, email: true },
                },
            },
        });

        if (!instructor) {
            throw new NotFoundException(
                'No se encontró un perfil de instructor para este usuario',
            );
        }

        return instructor;
    }
}