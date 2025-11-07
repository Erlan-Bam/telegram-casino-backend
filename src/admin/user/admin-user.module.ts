import { Module } from '@nestjs/common';
import { AdminUserService } from './admin-user.service';
import { AdminUserController } from './admin-user.controller';

@Module({
  providers: [AdminUserService],
  controllers: [AdminUserController],
})
export class AdminUserModule {}
