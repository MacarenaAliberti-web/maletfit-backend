import { Controller, Get, UseGuards } from '@nestjs/common';
import { InstructorsService } from './instructors.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';

@Controller('instructors')
@UseGuards(JwtGuard, RolesGuard)
export class InstructorsController {
    constructor(private readonly instructorsService: InstructorsService) { }

    @Get('me')
    @Roles(Role.INSTRUCTOR, Role.ADMIN)
    findMyProfile(@GetUser('sub') userId: string) {
        return this.instructorsService.findMyProfile(userId);
    }

    @Get()
    @Roles(Role.ADMIN, Role.INSTRUCTOR)
    findAll() {
        return this.instructorsService.findAll();
    }
}