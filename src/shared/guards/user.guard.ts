import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';

type UserPayload = {
  id: string;
  role: 'USER' | 'ADMIN';
  isBanned: boolean;
};

@Injectable()
export class UserGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: UserPayload }>();
    const user = req.user;

    if (!user) {
      throw new HttpException('User not authenticated', 401);
    }

    if (user.isBanned) {
      throw new HttpException('Access denied: User is banned', 403);
    }

    return true;
  }
}
