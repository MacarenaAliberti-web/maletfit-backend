import {
    Controller,
    Get,
    Post,
    Patch,
    Delete,
    Body,
    Param,
    UseGuards,
} from '@nestjs/common';
import { RoutinesService } from './routines.service';
import { CreateRoutineDto } from './dto/create-routine.dto';
import { UpdateRoutineDto } from './dto/update-routine.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';

@Controller('routines')
@UseGuards(JwtGuard)
export class RoutinesController {
    constructor(private readonly routinesService: RoutinesService) { }

    @Post()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.INSTRUCTOR)
    create(@Body() dto: CreateRoutineDto) {
        return this.routinesService.create(dto);
    }

    @Get('my-routines')
    findMyRoutines(@GetUser('sub') userId: string) {
        return this.routinesService.findMyRoutines(userId);
    }

    @Get()
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.INSTRUCTOR)
    findAll() {
        return this.routinesService.findAll();
    }

    @Get(':id')
    findOne(
        @Param('id') id: string,
        @GetUser('sub') userId: string,
        @GetUser('role') role: string,
    ) {
        return this.routinesService.findOne(id, userId, role);
    }

    @Patch(':id')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.INSTRUCTOR)
    update(@Param('id') id: string, @Body() dto: UpdateRoutineDto) {
        return this.routinesService.update(id, dto);
    }

    @Delete(':id')
    @UseGuards(RolesGuard)
    @Roles(Role.ADMIN, Role.INSTRUCTOR)
    remove(@Param('id') id: string) {
        return this.routinesService.remove(id);
    }
}