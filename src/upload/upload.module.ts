import { Module, forwardRef } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { TelegramModule } from '../telegram/telegram.module';

@Module({
  imports: [forwardRef(() => TelegramModule)],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}
