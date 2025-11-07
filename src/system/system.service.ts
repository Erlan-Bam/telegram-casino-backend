import { Injectable, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../shared/services/prisma.service';
import { BotService } from '../shared/services/bot.service';
import { UpdateBotTokenDto } from './dto/update-bot-token.dto';
import { UpdateAviatorChancesDto } from './dto/update-aviator-chances.dto';
import { SystemKey } from '@prisma/client';

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly botService: BotService,
  ) {}

  /**
   * Get all system variables
   */
  async findAll() {
    try {
      const systemVariables = await this.prisma.system.findMany({
        orderBy: { key: 'asc' },
      });

      return systemVariables.map((variable) => ({
        key: variable.key,
        value:
          variable.key === SystemKey.AVIATOR_CHANCES
            ? JSON.parse(variable.value)
            : variable.value,
      }));
    } catch (error) {
      this.logger.error('Failed to fetch system variables', error);
      throw new HttpException('Failed to fetch system variables', 500);
    }
  }

  /**
   * Get a specific system variable by key
   */
  async findOne(key: SystemKey) {
    try {
      const variable = await this.prisma.system.findUnique({
        where: { key },
      });

      if (!variable) {
        throw new HttpException(`System variable '${key}' not found`, 404);
      }

      return {
        key: variable.key,
        value:
          variable.key === SystemKey.AVIATOR_CHANCES
            ? JSON.parse(variable.value)
            : variable.value,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch system variable '${key}'`, error);
      throw new HttpException('Failed to fetch system variable', 500);
    }
  }

  /**
   * Update Telegram bot token
   */
  async updateBotToken(dto: UpdateBotTokenDto) {
    try {
      const updated = await this.prisma.system.upsert({
        where: { key: SystemKey.TELEGRAM_BOT_TOKEN },
        update: { value: dto.token },
        create: {
          key: SystemKey.TELEGRAM_BOT_TOKEN,
          value: dto.token,
        },
      });

      // Reload bot with new token
      await this.botService.reloadBotToken();

      return {
        key: updated.key,
        value: updated.value,
      };
    } catch (error) {
      this.logger.error('Failed to update bot token', error);
      throw new HttpException('Failed to update bot token', 500);
    }
  }

  /**
   * Update aviator chances configuration
   */
  async updateAviatorChances(dto: UpdateAviatorChancesDto) {
    try {
      // Validate ranges
      this.validateAviatorRanges(dto.ranges);

      const updated = await this.prisma.system.upsert({
        where: { key: SystemKey.AVIATOR_CHANCES },
        update: { value: JSON.stringify(dto.ranges) },
        create: {
          key: SystemKey.AVIATOR_CHANCES,
          value: JSON.stringify(dto.ranges),
        },
      });

      return {
        key: updated.key,
        value: JSON.parse(updated.value),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to update aviator chances', error);
      throw new HttpException('Failed to update aviator chances', 500);
    }
  }

  /**
   * Update WebApp URL
   */
  async updateWebAppUrl(url: string) {
    try {
      const updated = await this.prisma.system.upsert({
        where: { key: SystemKey.WEBAPP_URL },
        update: { value: url },
        create: {
          key: SystemKey.WEBAPP_URL,
          value: url,
        },
      });

      // Reload WebApp URL in bot service
      await this.botService.reloadWebAppUrl();

      return {
        key: updated.key,
        value: updated.value,
      };
    } catch (error) {
      this.logger.error('Failed to update WebApp URL', error);
      throw new HttpException('Failed to update WebApp URL', 500);
    }
  }

  /**
   * Validate aviator ranges (no overlaps, sum of chances = 100%, from < to)
   */
  private validateAviatorRanges(ranges: UpdateAviatorChancesDto['ranges']) {
    // Check if from < to for all ranges
    for (const range of ranges) {
      if (range.from >= range.to) {
        throw new HttpException(
          `Invalid range: 'from' (${range.from}) must be less than 'to' (${range.to})`,
          400,
        );
      }
    }

    // Check for overlaps
    const sortedRanges = [...ranges].sort((a, b) => a.from - b.from);
    for (let i = 0; i < sortedRanges.length - 1; i++) {
      if (sortedRanges[i].to > sortedRanges[i + 1].from) {
        throw new HttpException(
          `Overlapping ranges detected: [${sortedRanges[i].from}-${sortedRanges[i].to}] and [${sortedRanges[i + 1].from}-${sortedRanges[i + 1].to}]`,
          400,
        );
      }
    }

    // Check if sum of chances equals 100%
    const totalChance = ranges.reduce((sum, range) => sum + range.chance, 0);
    if (Math.abs(totalChance - 100) > 0.01) {
      throw new HttpException(
        `Sum of chances must equal 100%, got ${totalChance}%`,
        400,
      );
    }
  }
}
