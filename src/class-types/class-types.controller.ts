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
import { CreateClassTypeDto } from './dto/create-class-type.dto';

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
    create(@Body() dto: CreateClassTypeDto) {
        return this.classTypesService.create(dto);
    }
}