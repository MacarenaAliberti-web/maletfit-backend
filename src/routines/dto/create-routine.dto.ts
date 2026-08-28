import {
    IsString,
    IsNotEmpty,
    IsOptional,
    IsUUID,
    IsArray,
    ValidateNested,
    ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateExerciseDto } from './create-exercise.dto';

export class CreateRoutineDto {
    @IsUUID()
    @IsNotEmpty()
    userId: string; // el alumno al que se le asigna la rutina

    @IsString()
    @IsNotEmpty()
    title: string;

    @IsString()
    @IsOptional()
    notes?: string;

    @IsArray()
    @ArrayMinSize(1)
    @ValidateNested({ each: true })
    @Type(() => CreateExerciseDto)
    exercises: CreateExerciseDto[];
}