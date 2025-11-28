import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  HttpException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { GiftService } from '../shared/services/gift.service';
import { TelegramUserbotService } from '../shared/services/telegram-userbot.service';
import { UserGuard } from '../shared/guards/user.guard';
import { User } from '../shared/decorator/user.decorator';
import {
  PaginationDto,
  ConvertGiftToPrizeDto,
  ConvertGiftToInventoryDto,
  SendGiftNotificationDto,
} from './dto/gift.dto';

@ApiTags('Gifts')
@Controller('gift')
export class GiftController {
  constructor(
    private readonly giftService: GiftService,
    private readonly telegramUserbotService: TelegramUserbotService,
  ) {}

  @Get('my-gifts')
  @UseGuards(UserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get current user's Telegram gifts" })
  @ApiResponse({
    status: 200,
    description: 'Returns user gifts with pagination',
  })
  async getMyGifts(
    @User('telegramId') telegramId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    try {
      const { page = 1, limit = 20 } = paginationDto;
      const offset = (page - 1) * limit;

      const result = await this.giftService.getUserGifts(
        telegramId,
        limit,
        offset,
      );

      return {
        data: result.gifts,
        meta: {
          total: result.totalCount,
          page,
          limit,
          totalPages: Math.ceil(result.totalCount / limit),
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get user gifts', 500);
    }
  }

  @Get('available')
  @UseGuards(UserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get available gifts that can be converted' })
  @ApiResponse({ status: 200, description: 'Returns unconverted gifts' })
  async getAvailableGifts(@Query() paginationDto: PaginationDto) {
    try {
      const { page = 1, limit = 50 } = paginationDto;
      const offset = (page - 1) * limit;

      const result = await this.giftService.getAvailableGiftsForConversion(
        limit,
        offset,
      );

      return {
        data: result.gifts,
        meta: {
          total: result.totalCount,
          page,
          limit,
          totalPages: Math.ceil(result.totalCount / limit),
          hasMore: result.hasMore,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get available gifts', 500);
    }
  }

  @Post('convert-to-inventory')
  @UseGuards(UserGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Convert a Telegram gift to inventory item' })
  @ApiResponse({ status: 201, description: 'Gift converted successfully' })
  async convertToInventory(
    @User('id') userId: string,
    @Body() dto: ConvertGiftToPrizeDto,
  ) {
    try {
      const result = await this.giftService.convertGiftToInventoryItem(
        dto.giftId,
        userId,
      );

      return {
        success: true,
        message: 'Gift converted to inventory item successfully',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to convert gift to inventory', 500);
    }
  }

  @Get('nft')
  @ApiOperation({ summary: 'Get all NFT gifts' })
  @ApiResponse({ status: 200, description: 'Returns NFT gifts' })
  async getNFTGifts(@Query() paginationDto: PaginationDto) {
    try {
      const { page = 1, limit = 100 } = paginationDto;
      const offset = (page - 1) * limit;

      const result = await this.giftService.getAllNFTGifts(limit, offset);

      return {
        data: result.gifts,
        meta: {
          total: result.count,
          page,
          limit,
          totalPages: Math.ceil(result.count / limit),
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get NFT gifts', 500);
    }
  }
}
