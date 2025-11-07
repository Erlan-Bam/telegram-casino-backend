import { Module } from '@nestjs/common';
import { AdminCaseService } from './admin-case.service';
import { AdminCaseController } from './admin-case.controller';

@Module({
  controllers: [AdminCaseController],
  providers: [AdminCaseService],
})
export class AdminCaseModule {}
