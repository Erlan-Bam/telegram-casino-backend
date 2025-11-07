import {
  Injectable,
  Logger,
  OnModuleInit,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../shared/services/prisma.service';
import { SystemKey, AviatorStatus } from '@prisma/client';
import { AviatorRangeDto } from '../system/dto/aviator-range.dto';

@Injectable()
export class AviatorService implements OnModuleInit {
  private readonly logger = new Logger(AviatorService.name);
  private aviatorChances: AviatorRangeDto[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadAviatorChances();
  }

  /**
   * Load and cache AVIATOR_CHANCES from system variables
   */
  private async loadAviatorChances() {
    try {
      await this.prisma.ensureConnected();

      const systemVar = await this.prisma.system.findUnique({
        where: { key: SystemKey.AVIATOR_CHANCES },
      });

      if (!systemVar) {
        this.logger.warn('AVIATOR_CHANCES not found in system variables, using defaults');
        // Set default chances if not found
        this.aviatorChances = [
          { from: 1, to: 2, chance: 70 },
          { from: 2, to: 5, chance: 20 },
          { from: 5, to: 10, chance: 8 },
          { from: 10, to: 20, chance: 2 },
        ];
      } else {
        this.aviatorChances = JSON.parse(systemVar.value);
      }

      this.logger.log('Aviator chances loaded successfully');
    } catch (error) {
      this.logger.error('Failed to load aviator chances, using defaults', error);
      // Don't throw during initialization - use defaults instead
      this.aviatorChances = [
        { from: 1, to: 2, chance: 70 },
        { from: 2, to: 5, chance: 20 },
        { from: 5, to: 10, chance: 8 },
        { from: 10, to: 20, chance: 2 },
      ];
    }
  }

  /**
   * Reload aviator chances from database (call after admin updates)
   */
  async reloadAviatorChances() {
    await this.loadAviatorChances();
  }

  /**
   * Generate random multiplier based on chances configuration
   */
  private generateMultiplier(): number {
    const totalChance = this.aviatorChances.reduce((a, b) => a + b.chance, 0);
    const random = Math.random() * totalChance;
    let cumulativeChance = 0;

    for (const range of this.aviatorChances) {
      cumulativeChance += range.chance;
      if (random <= cumulativeChance) {
        const multiplier = range.from + Math.random() * (range.to - range.from);
        return Math.round(multiplier * 100) / 100;
      }
    }

    return this.aviatorChances[0]?.from || 1;
  }

  /**
   * Create or get active aviator game
   * Only one ACTIVE game can exist at a time
   */
  async createOrGetAviator() {
    try {
      // Check if there's already an active game
      const existingGame = await this.prisma.aviator.findFirst({
        where: {
          status: AviatorStatus.ACTIVE,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          bets: {
            select: {
              id: true,
              amount: true,
              cashedAt: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  telegramId: true,
                },
              },
            },
          },
        },
      });

      if (existingGame) {
        return existingGame;
      }

      // Create new game with startsAt = now + 6 seconds
      const startsAt = new Date(Date.now() + 6000);
      const multiplier = this.generateMultiplier();

      const newGame = await this.prisma.aviator.create({
        data: {
          startsAt,
          multiplier,
          status: AviatorStatus.ACTIVE,
        },
        include: {
          bets: {
            select: {
              id: true,
              amount: true,
              cashedAt: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  telegramId: true,
                },
              },
            },
          },
        },
      });

      this.logger.log(
        `Created new aviator game #${newGame.id} with multiplier ${multiplier}x, starts at ${startsAt.toISOString()}`,
      );

      return newGame;
    } catch (error) {
      this.logger.error('Failed to create or get aviator game', error);
      throw new HttpException('Failed to create or get aviator game', 500);
    }
  }

  /**
   * Get current active game
   */
  async getCurrentGame() {
    try {
      const game = await this.prisma.aviator.findFirst({
        where: {
          status: AviatorStatus.ACTIVE,
        },
        orderBy: {
          createdAt: 'desc',
        },
        include: {
          bets: {
            select: {
              id: true,
              amount: true,
              cashedAt: true,
              createdAt: true,
              user: {
                select: {
                  id: true,
                  username: true,
                  telegramId: true,
                },
              },
            },
          },
        },
      });

      if (!game) {
        throw new HttpException('No active aviator game found', 404);
      }

      return game;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to get current aviator game', error);
      throw new HttpException('Failed to get current aviator game', 500);
    }
  }

  /**
   * Update game status
   */
  async updateGameStatus(id: number, status: AviatorStatus) {
    try {
      const updatedGame = await this.prisma.aviator.update({
        where: { id },
        data: { status },
      });

      this.logger.log(`Updated aviator game #${id} status to ${status}`);

      return updatedGame;
    } catch (error) {
      this.logger.error(`Failed to update aviator game #${id} status`, error);
      throw new HttpException('Failed to update aviator game status', 500);
    }
  }

  /**
   * Place a bet on the current aviator game
   * Validates bet amount, checks user balance, and creates bet in atomic transaction
   */
  async placeBet(userId: string, aviatorId: number, amount: number) {
    try {
      // Validate bet amount
      if (amount < 25) {
        throw new HttpException('Minimum bet amount is 25', 400);
      }
      if (amount > 10000) {
        throw new HttpException('Maximum bet amount is 10000', 400);
      }

      // Get the specific aviator game
      const game = await this.prisma.aviator.findUnique({
        where: {
          id: aviatorId,
        },
      });

      if (!game) {
        throw new HttpException('Aviator game not found', 404);
      }

      // Check if game is still active
      if (game.status !== AviatorStatus.ACTIVE) {
        throw new HttpException('Game is no longer active', 400);
      }

      // Check if game has already started
      if (new Date() >= game.startsAt) {
        throw new HttpException(
          'Game has already started, cannot place bet',
          400,
        );
      }

      // Use transaction for atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Get user with current balance
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

        // Check if user already has a bet on this game
        const existingBet = await tx.bet.findFirst({
          where: {
            aviatorId: game.id,
            userId: userId,
          },
        });

        if (existingBet) {
          throw new HttpException('You already have a bet on this game', 400);
        }

        // Decrement user balance with atomic check
        const updateResult = await tx.user.updateMany({
          where: {
            id: userId,
            balance: {
              gte: amount,
            },
          },
          data: {
            balance: {
              decrement: amount,
            },
          },
        });

        // If no rows were updated, balance was insufficient
        if (updateResult.count === 0) {
          throw new HttpException('Insufficient balance', 400);
        }

        // Create bet
        const bet = await tx.bet.create({
          data: {
            aviatorId: game.id,
            userId: userId,
            amount: amount,
          },
          include: {
            aviator: true,
            user: {
              select: {
                id: true,
                username: true,
                balance: true,
              },
            },
          },
        });

        return bet;
      });

      this.logger.log(
        `User ${userId} placed bet of ${amount} on aviator game #${game.id}`,
      );

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to place bet on aviator game', error);
      throw new HttpException('Failed to place bet on aviator game', 500);
    }
  }

  /**
   * Cash out a bet at the current multiplier
   * Validates bet exists, hasn't been cashed out, and game is still active
   */
  async cashOut(userId: string, betId: number, currentMultiplier: number) {
    try {
      // Validate current multiplier
      if (currentMultiplier < 1) {
        throw new HttpException('Invalid multiplier', 400);
      }

      // Use transaction for atomicity
      const result = await this.prisma.$transaction(async (tx) => {
        // Get bet with game and user info
        const bet = await tx.bet.findUnique({
          where: { id: betId },
          include: {
            aviator: true,
            user: {
              select: {
                id: true,
                username: true,
                balance: true,
                isBanned: true,
              },
            },
          },
        });

        if (!bet) {
          throw new HttpException('Bet not found', 404);
        }

        // Check if bet belongs to the user
        if (bet.userId !== userId) {
          throw new HttpException('Unauthorized to cash out this bet', 403);
        }

        // Check if user is banned
        if (bet.user.isBanned) {
          throw new HttpException('User is banned', 403);
        }

        // Check if bet has already been cashed out
        if (bet.cashedAt !== null) {
          throw new HttpException('Bet has already been cashed out', 400);
        }

        // Check if game is still active
        if (bet.aviator.status !== AviatorStatus.ACTIVE) {
          throw new HttpException('Game is no longer active', 400);
        }

        // Check if game has started
        if (new Date() < bet.aviator.startsAt) {
          throw new HttpException('Game has not started yet', 400);
        }

        // Check if current multiplier exceeds game's final multiplier
        if (currentMultiplier > bet.aviator.multiplier.toNumber()) {
          throw new HttpException(
            'Cannot cash out after plane has crashed',
            400,
          );
        }

        // Calculate winnings
        const winAmount = Math.floor(bet.amount * currentMultiplier);

        // Update bet with cashedAt multiplier
        const updatedBet = await tx.bet.update({
          where: { id: betId },
          data: {
            cashedAt: currentMultiplier,
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                balance: true,
              },
            },
          },
        });

        // Add winnings to user balance
        await tx.user.update({
          where: { id: userId },
          data: {
            balance: {
              increment: winAmount,
            },
          },
        });

        return {
          bet: updatedBet,
          winAmount,
          multiplier: currentMultiplier,
        };
      });

      this.logger.log(
        `User ${userId} cashed out bet #${betId} at ${currentMultiplier}x for ${result.winAmount} coins`,
      );

      return result;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to cash out bet', error);
      throw new HttpException('Failed to cash out bet', 500);
    }
  }
}
