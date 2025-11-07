import { Module } from '@nestjs/common';
import { AdminPrizeService } from './admin-prize.service';
import { AdminPrizeController } from './admin-prize.controller';

@Module({
  controllers: [AdminPrizeController],
  providers: [AdminPrizeService],
})
export class AdminPrizeModule {}
