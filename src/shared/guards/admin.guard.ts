// admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';

type JwtUser = {
  id: string;
  role: 'USER' | 'ADMIN';
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = req.user;

    if (!user) {
      throw new HttpException('User not authenticated', 401);
    }
    if (user.role !== 'ADMIN') {
      throw new HttpException('Access denied: Admins only', 403);
    }
    return true;
  }
}
