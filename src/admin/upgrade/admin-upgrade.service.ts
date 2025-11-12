import { Injectable, Logger, HttpException } from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreateUpgradeChanceDto } from './dto/create-upgrade-chance.dto';
import { UpdateUpgradeChanceDto } from './dto/update-upgrade-chance.dto';
import { DeleteUpgradeChanceDto } from './dto/delete-upgrade-chance.dto';
import { EditMultiplierDto } from './dto/edit-multiplier.dto';
import { UpgradeChanceResponseDto } from './dto/upgrade-chance-response.dto';

@Injectable()
export class AdminUpgradeService {
  private readonly logger = new Logger(AdminUpgradeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get all upgrade chances
   */
  async getAllUpgradeChances(): Promise<UpgradeChanceResponseDto[]> {
    try {
      await this.prisma.ensureConnected();

      const chances = await this.prisma.upgradeChance.findMany({
        orderBy: {
          multiplier: 'asc',
        },
      });

      return chances.map((chance) => ({
        id: chance.id,
        multiplier: Number(chance.multiplier),
        chance: Number(chance.chance),
        createdAt: chance.createdAt,
        updatedAt: chance.updatedAt,
      }));
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to get upgrade chances', error);
      throw new HttpException('Failed to get upgrade chances', 500);
    }
  }

  /**
   * Create new upgrade chance multiplier
   */
  async createUpgradeChance(
    dto: CreateUpgradeChanceDto,
  ): Promise<UpgradeChanceResponseDto> {
    try {
      await this.prisma.ensureConnected();

      // Check if multiplier already exists
      const existing = await this.prisma.upgradeChance.findUnique({
        where: { multiplier: dto.multiplier },
      });

      if (existing) {
        throw new HttpException('Multiplier already exists', 400);
      }

      const upgradeChance = await this.prisma.upgradeChance.create({
        data: {
          multiplier: dto.multiplier,
          chance: dto.chance,
        },
      });

      this.logger.log(
        `Created upgrade chance: X${dto.multiplier} with ${dto.chance * 100}% chance`,
      );

      return {
        id: upgradeChance.id,
        multiplier: Number(upgradeChance.multiplier),
        chance: Number(upgradeChance.chance),
        createdAt: upgradeChance.createdAt,
        updatedAt: upgradeChance.updatedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to create upgrade chance', error);
      throw new HttpException('Failed to create upgrade chance', 500);
    }
  }

  /**
   * Update upgrade chance by ID
   */
  async updateUpgradeChance(
    dto: UpdateUpgradeChanceDto,
  ): Promise<UpgradeChanceResponseDto> {
    try {
      await this.prisma.ensureConnected();

      // Check if record exists
      const existing = await this.prisma.upgradeChance.findUnique({
        where: { id: dto.id },
      });

      if (!existing) {
        throw new HttpException('Upgrade chance not found', 404);
      }

      // If multiplier is being changed, check if new multiplier already exists
      if (dto.multiplier && dto.multiplier !== Number(existing.multiplier)) {
        const multiplierExists = await this.prisma.upgradeChance.findUnique({
          where: { multiplier: dto.multiplier },
        });

        if (multiplierExists) {
          throw new HttpException('Multiplier already exists', 400);
        }
      }

      const upgradeChance = await this.prisma.upgradeChance.update({
        where: { id: dto.id },
        data: {
          multiplier: dto.multiplier ?? existing.multiplier,
          chance: dto.chance,
        },
      });

      this.logger.log(
        `Updated upgrade chance: ID ${dto.id} - X${upgradeChance.multiplier} with ${dto.chance * 100}% chance`,
      );

      return {
        id: upgradeChance.id,
        multiplier: Number(upgradeChance.multiplier),
        chance: Number(upgradeChance.chance),
        createdAt: upgradeChance.createdAt,
        updatedAt: upgradeChance.updatedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to update upgrade chance', error);
      throw new HttpException('Failed to update upgrade chance', 500);
    }
  }

  /**
   * Initialize default upgrade chances if they don't exist
   */
  async initializeDefaultChances(): Promise<void> {
    try {
      await this.prisma.ensureConnected();

      const defaultChances = [
        { multiplier: 1.5, chance: 0.75 }, // 75% for 1.5x
        { multiplier: 2, chance: 0.5 }, // 50% for 2x
        { multiplier: 3, chance: 0.33 }, // 33% for 3x
        { multiplier: 5, chance: 0.2 }, // 20% for 5x
        { multiplier: 10, chance: 0.1 }, // 10% for 10x
      ];

      for (const defaultChance of defaultChances) {
        await this.prisma.upgradeChance.upsert({
          where: {
            multiplier: defaultChance.multiplier,
          },
          update: {},
          create: {
            multiplier: defaultChance.multiplier,
            chance: defaultChance.chance,
          },
        });
      }

      this.logger.log('Default upgrade chances initialized');
    } catch (error) {
      this.logger.error('Failed to initialize default upgrade chances', error);
      throw new HttpException(
        'Failed to initialize default upgrade chances',
        500,
      );
    }
  }

  /**
   * Delete upgrade chance by ID
   */
  async deleteUpgradeChance(
    dto: DeleteUpgradeChanceDto,
  ): Promise<{ message: string }> {
    try {
      await this.prisma.ensureConnected();

      // Check if record exists
      const existing = await this.prisma.upgradeChance.findUnique({
        where: { id: dto.id },
      });

      if (!existing) {
        throw new HttpException('Upgrade chance not found', 404);
      }

      await this.prisma.upgradeChance.delete({
        where: { id: dto.id },
      });

      this.logger.log(
        `Deleted upgrade chance: ID ${dto.id} (X${existing.multiplier})`,
      );

      return {
        message: `Upgrade chance deleted successfully`,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to delete upgrade chance', error);
      throw new HttpException('Failed to delete upgrade chance', 500);
    }
  }

  /**
   * Edit multiplier value (change the multiplier itself)
   */
  async editMultiplier(
    dto: EditMultiplierDto,
  ): Promise<UpgradeChanceResponseDto> {
    try {
      await this.prisma.ensureConnected();

      // Check if old multiplier exists
      const existing = await this.prisma.upgradeChance.findUnique({
        where: { multiplier: dto.oldMultiplier },
      });

      if (!existing) {
        throw new HttpException('Old multiplier not found', 404);
      }

      // Check if new multiplier already exists
      if (dto.oldMultiplier !== dto.newMultiplier) {
        const newExists = await this.prisma.upgradeChance.findUnique({
          where: { multiplier: dto.newMultiplier },
        });

        if (newExists) {
          throw new HttpException('New multiplier already exists', 400);
        }
      }

      // Delete old and create new (since multiplier is unique constraint)
      await this.prisma.upgradeChance.delete({
        where: { multiplier: dto.oldMultiplier },
      });

      const upgradeChance = await this.prisma.upgradeChance.create({
        data: {
          multiplier: dto.newMultiplier,
          chance: dto.chance ?? existing.chance,
        },
      });

      this.logger.log(
        `Edited multiplier: X${dto.oldMultiplier} → X${dto.newMultiplier}`,
      );

      return {
        id: upgradeChance.id,
        multiplier: Number(upgradeChance.multiplier),
        chance: Number(upgradeChance.chance),
        createdAt: upgradeChance.createdAt,
        updatedAt: upgradeChance.updatedAt,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to edit multiplier', error);
      throw new HttpException('Failed to edit multiplier', 500);
    }
  }
}
