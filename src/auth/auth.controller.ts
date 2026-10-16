import {
  Controller,
  Post,
  Body,
  UseGuards,
  Get,
  Patch,
  Request,
  Res,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';

// Cookie options for HTTP-Only, Secure, Cross-Site cookie
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: true,
  sameSite: 'none' as const,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * Login: Validates credentials, sets the JWT as an HTTP-Only cookie,
   * and returns only the user profile (no raw token in body).
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.login(loginDto);

    // Set the access token in an HTTP-Only, Secure cookie
    res.cookie('token', result.access_token, COOKIE_OPTIONS);

    // Return only user data — never expose raw tokens in the response body
    return {
      message: 'Login successful',
      user: result.user,
    };
  }

  /**
   * Logout: Clears the HTTP-Only cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie('token', {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
    });
    return { message: 'Logged out successfully' };
  }

  @Post('refresh')
  async refresh(@Request() req) {
    // With cookie-based auth, refresh can read the cookie directly
    const token = req.cookies?.['token'];
    return this.authService.refreshToken(token);
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req) {
    return this.authService.getProfile(req.user);
  }

  @Patch('profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(@Request() req, @Body() body: any) {
    return this.authService.updateProfile(req.user.userId, body);
  }

  @Post('forgot-password')
  async forgotPassword(@Body() body: { email: string }) {
    return this.authService.forgotPassword(body.email);
  }

  @Post('reset-password')
  async resetPassword(@Body() body: any) {
    return this.authService.resetPassword(body);
  }

  @Post('verify-otp')
  async verifyOTP(@Body() body: { otp: string }) {
    return this.authService.verifyOTP(body.otp);
  }

  @Post('change-password')
  @UseGuards(JwtAuthGuard)
  async changePassword(@Request() req, @Body() body: any) {
    return this.authService.changePassword(req.user.userId, body);
  }
}
