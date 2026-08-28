import { Module } from '@nestjs/common';
import { ClassTypesController } from './class-types.controller';
import { ClassTypesService } from './class-types.service';
import { PrismaModule } from '../prisma/prisma.module';
import { JwtModule } from '@nestjs/jwt';

@Module({
    imports: [
        PrismaModule,
        JwtModule.register({
            secret: process.env.JWT_SECRET,
        }),
    ],
    controllers: [ClassTypesController],
    providers: [ClassTypesService],
})
export class ClassTypesModule { }