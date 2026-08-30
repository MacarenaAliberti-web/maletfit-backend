import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

@Injectable()
export class UsersService {
    constructor(private readonly prisma: PrismaService) { }

    async findById(id: string) {
        const user = await this.prisma.user.findUnique({
            where: { id },
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true,
            },
        });

        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        return user;
    }

    async updateRole(requesterId: string, userId: string, role: Role) {
        if (requesterId === userId) {
            throw new BadRequestException('No podés cambiar tu propio rol');
        }

        const user = await this.prisma.user.findUnique({ where: { id: userId } });

        if (!user) {
            throw new NotFoundException('Usuario no encontrado');
        }

        return this.prisma.$transaction(async (tx) => {
            const updatedUser = await tx.user.update({
                where: { id: userId },
                data: { role },
                select: { id: true, email: true, fullName: true, role: true },
            });

            if (role === 'INSTRUCTOR') {
                const existingInstructor = await tx.instructor.findUnique({
                    where: { userId },
                });

                if (!existingInstructor) {
                    await tx.instructor.create({
                        data: { userId },
                    });
                }
            }

            return updatedUser;
        });
    }

    async findAllStudents() {
        return this.prisma.user.findMany({
            where: { role: 'STUDENT' },
            select: { id: true, fullName: true, email: true },
        });
    }

    async findAll() {
        return this.prisma.user.findMany({
            select: {
                id: true,
                email: true,
                fullName: true,
                role: true,
                createdAt: true,
            },
        });
    }
}