import {
    Injectable,
    CanActivate,
    ExecutionContext,
    UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Request } from 'express';

@Injectable()
export class JwtGuard implements CanActivate {
    constructor(private readonly jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest<Request>();
        const token = this.extractTokenFromCookie(request);

        if (!token) {
            throw new UnauthorizedException('Token no proporcionado');
        }

        try {
            const payload = await this.jwtService.verifyAsync(token, {
                secret: process.env.JWT_SECRET,
            });
            request['user'] = payload;
        } catch {
            throw new UnauthorizedException('Token inválido o expirado');
        }

        return true;
    }

    private extractTokenFromCookie(request: Request): string | undefined {
        return request.cookies?.['jwt'];
    }
}