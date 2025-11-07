import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { AdminUserModule } from './admin/user/admin-user.module';
import { AdminPrizeModule } from './admin/prize/admin-prize.module';
import { AdminCaseModule } from './admin/case/admin-case.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationOptions: { allowUnknown: true, abortEarly: true },
    }),
    ScheduleModule.forRoot(),
    SharedModule,
    UserModule,
    AdminUserModule,
    AdminPrizeModule,
    AdminCaseModule,
  ],
})
export class AppModule {}
