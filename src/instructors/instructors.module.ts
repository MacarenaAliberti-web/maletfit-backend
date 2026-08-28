import { Module } from '@nestjs/common';
import { InstructorsController } from './instructors.controller';
import { InstructorsService } from './instructors.service';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        JwtModule.register({
            secret: process.env.JWT_SECRET,
        }),
    ],
    controllers: [InstructorsController],
    providers: [InstructorsService],
})
export class InstructorsModule { }