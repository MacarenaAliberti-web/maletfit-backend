import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SchedulesModule } from './schedules/schedules.module';
import { BookingsModule } from './bookings/bookings.module';
import { RoutinesModule } from './routines/routines.module';
import { ClassTypesModule } from './class-types/class-types.module';

@Module({
  imports: [PrismaModule, AuthModule, UsersModule, SchedulesModule, BookingsModule, RoutinesModule, ClassTypesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
