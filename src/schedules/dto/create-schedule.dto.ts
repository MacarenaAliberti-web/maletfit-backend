import {
    IsDateString,
    IsInt,
    IsNotEmpty,
    IsOptional,
    IsString,
    Min,
} from 'class-validator';

export class CreateScheduleDto {
    @IsDateString()
    @IsNotEmpty()
    startTime!: string;

    @IsDateString()
    @IsNotEmpty()
    endTime!: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    capacity?: number; // Por defecto será 5 en el modelo/servicio

    @IsString()
    @IsNotEmpty()
    classTypeId!: string;

    @IsString()
    @IsNotEmpty()
    instructorId!: string;
}