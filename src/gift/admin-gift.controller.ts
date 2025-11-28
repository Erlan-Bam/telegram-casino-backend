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
import { AdminGuard } from '../shared/guards/admin.guard';
import {
  PaginationDto,
  ConvertGiftToPrizeDto,
  ConvertGiftToInventoryDto,
  SendGiftNotificationDto,
} from './dto/gift.dto';

@ApiTags('Admin - Gifts')
@Controller('admin/gift')
@UseGuards(AdminGuard)
@ApiBearerAuth()
export class AdminGiftController {
  constructor(
    private readonly giftService: GiftService,
    private readonly telegramUserbotService: TelegramUserbotService,
  ) {}

  @Get('all')
  @ApiOperation({ summary: 'Get all Telegram gifts (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Returns all gifts with pagination',
  })
  async getAllGifts(@Query() paginationDto: PaginationDto) {
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
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to get gifts', 500);
    }
  }

  @Post('convert-to-prize')
  @ApiOperation({ summary: 'Convert a Telegram gift to a prize (admin only)' })
  @ApiResponse({
    status: 201,
    description: 'Gift converted to prize successfully',
  })
  async convertToPrize(@Body() dto: ConvertGiftToPrizeDto) {
    try {
      const prize = await this.giftService.convertGiftToPrize(dto.giftId);

      return {
        success: true,
        message: 'Gift converted to prize successfully',
        data: prize,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to convert gift to prize', 500);
    }
  }

  @Post('convert-to-inventory')
  @ApiOperation({
    summary: 'Convert gift to inventory for specific user (admin only)',
  })
  @ApiResponse({
    status: 201,
    description: 'Gift converted to inventory successfully',
  })
  async convertToInventoryForUser(@Body() dto: ConvertGiftToInventoryDto) {
    try {
      const result = await this.giftService.convertGiftToInventoryItem(
        dto.giftId,
        dto.userId,
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

  @Post('send-notification')
  @ApiOperation({
    summary: 'Send gift notification to user via Telegram (admin only)',
  })
  @ApiResponse({ status: 201, description: 'Notification sent successfully' })
  async sendGiftNotification(@Body() dto: SendGiftNotificationDto) {
    try {
      const result = await this.telegramUserbotService.sendGiftToUser(
        dto.telegramUserId,
        {
          title: dto.title,
          description: dto.description,
        },
      );

      return {
        success: true,
        message: 'Gift notification sent successfully',
        data: result,
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException('Failed to send gift notification', 500);
    }
  }

  @Get('nft')
  @ApiOperation({ summary: 'Get all NFT gifts (admin only)' })
  @ApiResponse({ status: 200, description: 'Returns all NFT gifts' })
  async getAllNFTGifts(@Query() paginationDto: PaginationDto) {
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
