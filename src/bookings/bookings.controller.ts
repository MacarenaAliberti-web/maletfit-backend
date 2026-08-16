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
import { JwtGuard } from '../auth/jwt.guard';
import { GetUser } from '../auth/decorators/get-user.decorator';

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
}