import { Body, Controller, Get, Logger, Post, Inject } from '@nestjs/common';
import { UserService } from './user.service';
import {
  ApiBody,
  ApiOperation,
  ApiResponse,
  ApiTags,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { TelegramAuthDto } from './dto/telegram-auth.dto';
import { User } from 'src/shared/decorator/user.decorator';
import { WebsocketGateway } from 'src/websocket/websocket.gateway';

@Controller('user')
@ApiTags('User')
export class UserController {
  private readonly logger = new Logger(UserController.name);
  constructor(
    private userService: UserService,
    @Inject(WebsocketGateway)
    private readonly websocketGateway: WebsocketGateway,
  ) {}

  @Post('telegram')
  @ApiOperation({ summary: 'Authenticate with Telegram Web App' })
  @ApiBody({ type: TelegramAuthDto })
  @ApiResponse({
    status: 200,
    description: 'Authentication successful - JWT token returned',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          description: 'JWT access token for API authentication',
        },
      },
    },
  })
  async telegram(@Body() data: TelegramAuthDto) {
    try {
      return await this.userService.telegram(data);
    } catch (error) {
      this.logger.error('Failed to authenticate with Telegram: ', error);
      throw error;
    }
  }

  @Get('profile')
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get user profile' })
  @ApiResponse({
    status: 200,
    description: 'User profile retrieved successfully',
  })
  async getProfile(@User('id') userId: string) {
    return this.userService.getProfile(userId);
  }

  @Post('test')
  @ApiOperation({ summary: 'Test endpoint - Generate token for testing' })
  @ApiResponse({
    status: 201,
    description: 'Test token generated successfully',
    schema: {
      type: 'object',
      properties: {
        access_token: {
          type: 'string',
          description: 'JWT access token for testing',
        },
      },
    },
  })
  async test() {
    return this.userService.generateToken(
      'd581bb7e-56b1-4050-bcf2-b6afce518bad',
    );
  }

  @Get('active-users')
  @ApiOperation({ summary: 'Get active users count (public)' })
  @ApiResponse({
    status: 200,
    description: 'Returns count of active users',
  })
  getActiveUsers() {
    return {
      count: this.websocketGateway.getActiveUsersCount(),
      timestamp: new Date().toISOString(),
    };
  }
}
