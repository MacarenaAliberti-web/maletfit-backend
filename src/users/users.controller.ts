import { Controller, Get, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtGuard } from '../auth/jwt.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { GetUser } from '../auth/decorators/get-user.decorator';
import { Role } from '@prisma/client';

@Controller('users')
@UseGuards(JwtGuard, RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get('me')
  getProfile(@GetUser('sub') userId: string) {
    return this.usersService.findById(userId);
  }

  @Get('students')
  @Roles(Role.ADMIN, Role.INSTRUCTOR)
  getAllStudents() {
    return this.usersService.findAllStudents();
  }

  @Get()
  @Roles(Role.ADMIN)
  getAllUsers() {
    return this.usersService.findAll();
  }
}