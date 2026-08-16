import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchedulesModule } from './schedules/schedules.module';
import { BookingsModule } from './bookings/bookings.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, SchedulesModule, BookingsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
