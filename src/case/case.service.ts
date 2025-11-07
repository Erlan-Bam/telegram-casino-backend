import { Injectable, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../shared/services/prisma.service';

@Injectable()
export class CaseService {
  private readonly logger = new Logger(CaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Weighted random selection based on chances
   * Uses cumulative probability distribution
   */
  private selectPrizeByChance<T extends { chance: any }>(items: T[]): T {
    if (!items || items.length === 0) {
      throw new HttpException('Case has no items', 500);
    }

    // Calculate total weight (sum of all chances)
    const totalWeight = items.reduce(
      (sum, item) => sum + Number(item.chance),
      0,
    );

    if (totalWeight <= 0) {
      throw new HttpException(
        'Invalid case configuration: total chance is 0',
        500,
      );
    }

    // Generate random number between 0 and totalWeight
    const random = Math.random() * totalWeight;

    // Find the item based on cumulative probability
    let cumulativeWeight = 0;
    for (const item of items) {
      cumulativeWeight += Number(item.chance);
      if (random <= cumulativeWeight) {
        return item;
      }
    }

    // Fallback to last item (should never reach here due to floating point precision)
    return items[items.length - 1];
  }

  /**
   * Open a case for a user (with multiplier support)
   * - Validates case exists and has items
   * - Validates user has sufficient balance for all openings
   * - Selects prizes based on weighted random for each opening
   * - Decrements user balance using updateMany with gte check
   * - Adds prizes to user inventory
   * All in one atomic transaction
   */
  async openCase(caseId: number, userId: string, multiplier: number) {
    try {
      // Execute everything in a transaction
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Fetch case with items and prizes
        const caseData = await tx.case.findUnique({
          where: { id: caseId },
          include: {
            items: {
              include: {
                prize: true,
              },
            },
          },
        });

        if (!caseData) {
          throw new HttpException('Case not found', 404);
        }

        if (!caseData.items || caseData.items.length === 0) {
          throw new HttpException('Case has no items configured', 400);
        }

        // 2. Calculate total cost
        const totalCost = caseData.price * multiplier;

        // 3. Fetch user and check balance
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: { id: true, balance: true, isBanned: true },
        });

        if (!user) {
          throw new HttpException('User not found', 404);
        }

        if (user.isBanned) {
          throw new HttpException('User is banned', 403);
        }

        if (user.balance.lt(totalCost)) {
          throw new HttpException('Insufficient balance', 400);
        }

        // 4. Decrement user balance with updateMany and gte check
        const updateResult = await tx.user.updateMany({
          where: {
            id: userId,
            balance: {
              gte: totalCost,
            },
          },
          data: {
            balance: {
              decrement: totalCost,
            },
          },
        });

        if (updateResult.count === 0) {
          throw new HttpException('Insufficient balance', 400);
        }

        // 5. Open cases multiple times based on multiplier
        const wonPrizes = [];
        const inventoryData = [];

        for (let i = 0; i < multiplier; i++) {
          // Select prize using weighted random
          const selectedItem = this.selectPrizeByChance(caseData.items);
          const prize = selectedItem.prize;

          wonPrizes.push(prize);
          inventoryData.push({
            userId: userId,
            prizeId: prize.id,
          });
        }

        // Add all prizes to inventory in one request
        const inventoryResult = await tx.inventoryItem.createMany({
          data: inventoryData,
        });

        return {
          prizes: wonPrizes,
          inventoryCount: inventoryResult.count,
          remainingBalance: user.balance.toNumber() - totalCost,
        };
      });

      // Return formatted response
      return {
        prizes: result.prizes.map((prize) => ({
          prizeId: prize.id,
          prizeName: prize.name,
          prizeAmount: prize.amount,
          prizeUrl: prize.url,
        })),
        remainingBalance: result.remainingBalance,
        totalPrizesWon: result.prizes.length,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to open case', error);
      throw new HttpException('Failed to open case', 500);
    }
  }
}
