import { HttpException, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../services/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: any) {
    try {
      // Check if token is for admin (has isAdmin flag)
      if (payload.isAdmin === true) {
        const admin = await this.prisma.admin.findUnique({
          where: { id: payload.id },
          select: {
            id: true,
            login: true,
          },
        });

        if (!admin) {
          throw new HttpException('Admin not found', 401);
        }

        return {
          id: admin.id,
          isAdmin: true,
          login: admin.login,
        };
      }

      // Otherwise validate against User table
      const user = await this.prisma.user.findUnique({
        where: { id: payload.id },
        select: {
          id: true,
          isBanned: true,
          role: true,
        },
      });

      if (!user) {
        throw new HttpException('User not found', 401);
      }

      if (user.isBanned) {
        throw new HttpException('User is banned', 401);
      }

      return {
        id: user.id,
        isBanned: user.isBanned,
        role: user.role,
        isAdmin: false,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Invalid token', 401);
    }
  }
}
