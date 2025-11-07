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

    try {
      await this.$connect();
      this.isConnected = true;
      this.logger.log('Prisma connected successfully');
    } catch (error) {
      this.logger.error('Failed to connect to database', error);
      throw error;
    }

    return this.isConnected;
  }

  async ensureConnected() {
    if (!this.isConnected) {
      let retries = 3;
      let lastError: Error | null = null;

      while (retries > 0) {
        try {
          await this.connect();
          return;
        } catch (error) {
          lastError = error as Error;
          retries--;
          if (retries > 0) {
            this.logger.warn(`Connection failed, retrying... (${retries} attempts left)`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
          }
        }
      }

      this.logger.error('Failed to connect to database after multiple attempts');
      throw lastError || new Error('Failed to connect to database');
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.isConnected = false;
    this.logger.log('Prisma disconnected');
  }
}
