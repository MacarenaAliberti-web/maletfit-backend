import { Controller, Post, Body, Res, HttpCode, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const COOKIE_NAME = 'jwt';
const COOKIE_MAX_AGE_MS = 24 * 60 * 60 * 1000; // 1 día (coincide con la duración del JWT)

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const { user } = await this.authService.register(dto);
    // A propósito, no seteamos la cookie acá: el registro solo crea la
    // cuenta, el login sigue siendo el único punto donde se inicia sesión.
    return { user };
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { token, user } = await this.authService.login(dto);
    this.setAuthCookie(res, token);
    return { user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      path: '/',
    });
    return { message: 'Sesión cerrada correctamente' };
  }

  private setAuthCookie(res: Response, token: string) {
    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
      maxAge: COOKIE_MAX_AGE_MS,
      path: '/',
    });
  }
}