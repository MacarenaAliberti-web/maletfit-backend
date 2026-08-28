import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { SchedulesService } from './schedules.service';
import { CreateScheduleDto } from './dto/create-schedule.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
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

  // Rutas específicas ANTES que las rutas con :id
  @Get('my-schedules')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  findMySchedules(@GetUser('sub') userId: string) {
    return this.schedulesService.findMySchedules(userId);
  }

  @Get(':id/availability')
  getAvailability(@Param('id') id: string) {
    return this.schedulesService.getAvailability(id);
  }

  @Get(':id/roster')
  @Roles(Role.INSTRUCTOR, Role.ADMIN)
  getRoster(@Param('id') id: string) {
    return this.schedulesService.getRoster(id);
  }
}