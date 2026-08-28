import { IsString, IsNotEmpty, IsInt, IsOptional, IsNumber, Min } from 'class-validator';

export class CreateExerciseDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsInt()
    @Min(1)
    sets: number;

    @IsInt()
    @Min(1)
    reps: number;

    @IsNumber()
    @IsOptional()
    weightKg?: number;

    @IsInt()
    @IsOptional()
    orderIndex?: number;
}