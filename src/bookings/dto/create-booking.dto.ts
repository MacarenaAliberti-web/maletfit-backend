import { IsNotEmpty, IsUUID } from 'class-validator';

export class CreateBookingDto {
    @IsUUID()
    @IsNotEmpty()
    scheduleId!: string;
}