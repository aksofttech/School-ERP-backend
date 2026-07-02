import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private jwtService: JwtService,
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {}

  async register(registerDto: RegisterDto) {
    const { email, password, firstName, lastName } = registerDto;

    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new UnauthorizedException('User already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        firstName,
        lastName,
        // Default role is student, schoolId is optional for now
        role: 'STUDENT',
      },
    });

    // Generate tokens
    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.role,
      user.schoolId || null,
    );

    // In a production app, we would hash & save the refresh token to DB here.
    // await this.updateRefreshToken(user.id, tokens.refresh_token);

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        schoolId: user.schoolId,
      },
    };
  }

  async login(loginDto: LoginDto) {
    const { email, password } = loginDto;

    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.getTokens(
      user.id,
      user.email,
      user.role,
      user.schoolId || null,
    );

    return {
      ...tokens,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        schoolId: user.schoolId,
      },
    };
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      // Generate new tokens
      const tokens = await this.getTokens(
        user.id,
        user.email,
        user.role,
        user.schoolId || null,
      );

      return tokens;
    } catch (e) {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private async getTokens(
    userId: string,
    email: string,
    role: string,
    schoolId: string | null,
  ) {
    const payload = { sub: userId, email, role, schoolId };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: '1h', // Access token expires in 1 hour
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '7d', // Refresh token expires in 7 days
      }),
    ]);

    return {
      access_token: accessToken,
      refresh_token: refreshToken,
    };
  }

  async getProfile(user: any) {
    // User is attached to request by JwtStrategy
    const userProfile = await this.prisma.user.findUnique({
      where: { id: user.userId }, // JwtStrategy usually maps 'sub' to 'userId'
    });

    if (userProfile) {
      const { password, ...result } = userProfile;
      return result;
    }
    return null;
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Return same message for security (don't reveal user existence)
      return {
        message: 'If the email exists, a password reset link has been sent.',
      };
    }

    // Generate a random token
    const token =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    const expires = new Date();
    expires.setHours(expires.getHours() + 1); // 1 hour expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken: token,
        resetTokenExpires: expires,
      },
    });

    // 📧 IN PROD: Send actual email here.
    // FOR NOW: Log to console as a "Real-Mock" to allow developer testing.
    console.log(
      `[AUTH-SECURITY] CRITICAL: Password reset link for ${email}: http://localhost:3001/auth/reset-password?token=${token}`,
    );

    return {
      message: 'If the email exists, a password reset link has been sent.',
    };
  }

  async resetPassword(resetDto: any) {
    const { token, password } = resetDto;

    const user = await this.prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: { gt: new Date() },
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpires: null,
      },
    });

    return { message: 'Password has been reset successfully.' };
  }

  async verifyOTP(otp: string) {
    // Basic logic for a fixed test OTP or could be linked to a user
    // Implementing a "dummy-but-functional" version that requires specific code '123456' for now
    // until we link it to a full SMS/Email service.
    const isValid = otp === '123456';
    console.log(
      `[AUTH-SECURITY] OTP Verification attempt: ${otp} -> ${isValid ? 'VALID' : 'INVALID'}`,
    );
    return { valid: isValid };
  }

  async changePassword(changePasswordDto: any) {
    // Mock implementation
    console.log(`[Mock] Change password for user`);
    return { message: 'Password changed successfully' };
  }
}
