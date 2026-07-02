import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');

    // 🔒 HARD SAFETY CHECK
    if (!secret) {
      throw new Error('JWT_SECRET is not defined in environment variables');
    }

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: any) {
    if (!payload?.sub) {
      throw new UnauthorizedException();
    }

    // Check if user exists in DB to prevent "Ghost Users" (stale tokens after seed/wipe)
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, schoolId: true, email: true },
    });

    if (!user) {
      console.warn(
        `[JwtStrategy] Token valid but user ${payload.sub} not found in DB. Stale token?`,
      );
      throw new UnauthorizedException('User no longer exists');
    }

    return {
      userId: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.schoolId || null,
    };
  }
}
