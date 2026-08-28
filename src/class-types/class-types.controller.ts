import {
    Controller,
    Get,
    Post,
    Body,
    UseGuards,
} from '@nestjs/common';
import { ClassTypesService } from './class-types.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('class-types')
@UseGuards(JwtGuard)
export class ClassTypesController {
    constructor(private readonly classTypesService: ClassTypesService) { }

    @Get()
    findAll() {
        return this.classTypesService.findAll();
    }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN)
    create(@Body() body: { name: string; description?: string; durationMin?: number }) {
        return this.classTypesService.create(body);
    }
}