import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { CreateBookingDto } from './dto/create-booking.dto';
import { UpdateAttendanceDto } from './dto/update-attendance.dto';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';

@Controller('bookings')
@UseGuards(JwtGuard)
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) { }

  @Post()
  create(@GetUser('sub') userId: string, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(userId, dto);
  }

  @Get('my-bookings')
  findMyBookings(@GetUser('sub') userId: string) {
    return this.bookingsService.findMyBookings(userId);
  }

  @Patch(':id/cancel')
  cancel(@GetUser('sub') userId: string, @Param('id') bookingId: string) {
    return this.bookingsService.cancel(userId, bookingId);
  }

  @Patch(':id/attendance')
  @UseGuards(RolesGuard)
  @Roles(Role.ADMIN, Role.INSTRUCTOR)
  updateAttendance(
    @GetUser('sub') instructorId: string,
    @Param('id') bookingId: string,
    @Body() dto: UpdateAttendanceDto,
  ) {
    return this.bookingsService.updateAttendance(instructorId, bookingId, dto.status);
  }
}