// admin.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
} from '@nestjs/common';

type JwtUser = {
  id: string;
  isAdmin?: boolean;
  login?: string;
};

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: JwtUser }>();
    const user = req.user;

    if (!user) {
      throw new HttpException('User not authenticated', 401);
    }
    if (user.isAdmin !== true) {
      throw new HttpException('Access denied: Admins only', 403);
    }
    return true;
  }
}
