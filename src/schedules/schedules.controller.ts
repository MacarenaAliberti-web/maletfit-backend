import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('schedules')
@UseGuards(JwtGuard, RolesGuard)
export class SchedulesController {
  constructor(private readonly schedulesService: SchedulesService) { }

  @Post()
  @Roles(Role.ADMIN, Role.INSTRUCTOR)
  create(@Body() dto: CreateScheduleDto) {
    return this.schedulesService.create(dto);
  }

  @Get()
  findAll() {
    return this.schedulesService.findAll();
  }

  @Get(':id/availability')
  getAvailability(@Param('id') id: string) {
    return this.schedulesService.getAvailability(id);
  }
}