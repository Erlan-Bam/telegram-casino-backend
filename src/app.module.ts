import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { UserModule } from './user/user.module';
import { AdminUserModule } from './admin/user/admin-user.module';
import { AdminPrizeModule } from './admin/prize/admin-prize.module';
import { AdminCaseModule } from './admin/case/admin-case.module';
import { CaseModule } from './case/case.module';
import { WebsocketModule } from './websocket/websocket.module';
import { SystemModule } from './system/system.module';
import { PaymentModule } from './payment/payment.module';
import { AuthModule } from './auth/auth.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validationOptions: { allowUnknown: true, abortEarly: true },
    }),
    ScheduleModule.forRoot(),
    SharedModule,
    AuthModule,
    UserModule,
    AdminUserModule,
    AdminPrizeModule,
    AdminCaseModule,
    CaseModule,
    WebsocketModule,
    SystemModule,
    PaymentModule,
  ],
})
export class AppModule {}
