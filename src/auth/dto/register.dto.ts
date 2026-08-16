import { IsEmail, IsNotEmpty, IsString, MinLength } from 'class-validator';

export class RegisterDto {
    @IsEmail({}, { message: 'El email no es válido' })
    @IsNotEmpty()
    email!: string;

    @IsString()
    @MinLength(6, { message: 'La contraseña debe tener al menos 6 caracteres' })
    password!: string;

    @IsString()
    @IsNotEmpty()
    fullName!: string;
}