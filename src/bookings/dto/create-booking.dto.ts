import { IsNotEmpty, IsString } from 'class-validator';

export class CreateBookingDto {
    @IsString()
    @IsNotEmpty()
    scheduleId!: string;
}