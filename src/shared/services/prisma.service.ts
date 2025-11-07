import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private isConnected = false;

  async onModuleInit() {
    await this.connect();
  }

  async connect() {
    if (this.isConnected) {
      return;
    }

    await this.$connect();
    this.isConnected = true;

    return this.isConnected;
  }

  async ensureConnected() {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.isConnected = false;
    this.logger.log('Prisma disconnected');
  }
}
