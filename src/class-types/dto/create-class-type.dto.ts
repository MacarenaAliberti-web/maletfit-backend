import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreateClassTypeDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsString()
    @IsOptional()
    description?: string;

    @IsInt()
    @Min(1)
    @IsOptional()
    durationMin?: number;
}