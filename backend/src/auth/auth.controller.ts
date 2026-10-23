import { Controller, Post, Body } from '@nestjs/common';

@Controller('auth')
export class AuthController {
  @Post('login')
  mockLogin(@Body() body: any) {
    return {
      message: 'Mock login successful',
      user: {
        id: '1',
        email: body.email || 'student@test.com',
        role: 'STUDENT',
      },
      accessToken: 'mock-jwt-token-xyz',
    };
  }
}