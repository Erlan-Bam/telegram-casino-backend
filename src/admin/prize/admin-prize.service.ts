import {
  Injectable,
  Logger,
  HttpException,
} from '@nestjs/common';
import { PrismaService } from '../../shared/services/prisma.service';
import { CreatePrizeDto } from './dto/create-prize.dto';
import { UpdatePrizeDto } from './dto/update-prize.dto';
import { PaginationDto } from '../../shared/dto/pagination.dto';

@Injectable()
export class AdminPrizeService {
  private readonly logger = new Logger(AdminPrizeService.name);

  constructor(private prisma: PrismaService) {}

  async create(createPrizeDto: CreatePrizeDto) {
    try {
      const prize = await this.prisma.prize.create({
        data: createPrizeDto,
      });

      return prize;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to create prize', error);
      throw new HttpException('Failed to create prize', 500);
    }
  }

  async findAll(paginationDto: PaginationDto) {
    try {
      const { page = 1, limit = 20 } = paginationDto;
      const skip = (page - 1) * limit;

      const [prizes, total] = await Promise.all([
        this.prisma.prize.findMany({
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.prize.count(),
      ]);

      return {
        data: prizes,
        meta: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error('Failed to fetch prizes', error);
      throw new HttpException('Failed to fetch prizes', 500);
    }
  }

  async findOne(id: number) {
    try {
      const prize = await this.prisma.prize.findUnique({
        where: { id },
        include: {
          _count: {
            select: {
              inventory: true,
              case: true,
            },
          },
        },
      });

      if (!prize) {
        throw new HttpException(`Prize with ID ${id} not found`, 404);
      }

      return prize;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to fetch prize ${id}`, error);
      throw new HttpException('Failed to fetch prize', 500);
    }
  }

  async update(id: number, updatePrizeDto: UpdatePrizeDto) {
    try {
      // Check if prize exists
      await this.findOne(id);

      const prize = await this.prisma.prize.update({
        where: { id },
        data: updatePrizeDto,
      });

      return prize;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to update prize ${id}`, error);
      throw new HttpException('Failed to update prize', 500);
    }
  }

  async remove(id: number) {
    try {
      // Check if prize exists
      await this.findOne(id);

      // Check if prize is used in any case items
      const usageCount = await this.prisma.caseItem.count({
        where: { prizeId: id },
      });

      if (usageCount > 0) {
        throw new HttpException(
          `Cannot delete prize. It is used in ${usageCount} case item(s)`,
          400,
        );
      }

      await this.prisma.prize.delete({
        where: { id },
      });

      return { message: 'Prize deleted successfully' };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(`Failed to delete prize ${id}`, error);
      throw new HttpException('Failed to delete prize', 500);
    }
  }
}
