import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from './prisma.service';
import { AviatorStatus } from '@prisma/client';

@Injectable()
export class CronService {
  private readonly logger = new Logger(CronService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculate and update user ratings based on balance
   * Runs every 5 minutes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async updateUserRatings() {
    try {
      this.logger.log('Starting user rating calculation...');

      // Get all users ordered by balance (descending) and createdAt (for tie-breaking)
      const users = await this.prisma.user.findMany({
        select: {
          id: true,
          balance: true,
        },
        orderBy: [
          { balance: 'desc' },
          { createdAt: 'asc' }, // Users who registered earlier get better rank in case of tie
        ],
      });

      // Batch update ratings
      const updatePromises = users.map((user, index) => {
        const rating = index + 1; // Rank starts from 1
        return this.prisma.user.update({
          where: { id: user.id },
          data: { rating },
        });
      });

      await Promise.all(updatePromises);

      this.logger.log(`Successfully updated ratings for ${users.length} users`);
    } catch (error) {
      this.logger.error('Failed to update user ratings', error);
    }
  }

  /**
   * Cleanup stale aviator games so WAITING games that were missed don't stay forever.
   * Runs every 30 seconds.
   */
  @Cron(CronExpression.EVERY_30_SECONDS)
  async cleanupStaleAviatorGames() {
    try {
      this.logger.log('🧹 Checking for stale aviator games...');

      // Finalize WAITING games that should have started more than 15s ago
      const staleWaiting = await this.prisma.aviator.findMany({
        where: {
          status: AviatorStatus.WAITING,
          startsAt: { lt: new Date(Date.now() - 15_000) },
        },
      });

      for (const g of staleWaiting) {
        this.logger.warn(
          `⚠️ Finalizing stale WAITING game #${g.id} startedAt=${g.startsAt.toISOString()}`,
        );
        await this.prisma.aviator.update({
          where: { id: g.id },
          data: { status: AviatorStatus.FINISHED },
        });
      }

      // Finalize ACTIVE games that look like they've been running for too long (>30s)
      const staleActive = await this.prisma.aviator.findMany({
        where: {
          status: AviatorStatus.ACTIVE,
          startsAt: { lt: new Date(Date.now() - 30_000) },
        },
      });

      for (const g of staleActive) {
        this.logger.warn(
          `⚠️ Finalizing stale ACTIVE game #${g.id} startedAt=${g.startsAt.toISOString()}`,
        );
        await this.prisma.aviator.update({
          where: { id: g.id },
          data: { status: AviatorStatus.FINISHED },
        });
      }

      if (staleWaiting.length + staleActive.length > 0) {
        this.logger.log(
          `🧹 Cleaned up ${staleWaiting.length + staleActive.length} stale aviator games`,
        );
      }
    } catch (error) {
      this.logger.error('Failed to cleanup stale aviator games', error);
    }
  }
}
