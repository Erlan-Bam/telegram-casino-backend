import {
  Controller,
  Get,
  Put,
  Body,
  Param,
  UseGuards,
  Logger,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { SystemService } from './system.service';
import { UpdateBotTokenDto } from './dto/update-bot-token.dto';
import { UpdateAviatorChancesDto } from './dto/update-aviator-chances.dto';
import { UpdateWebAppUrlDto } from './dto/update-webapp-url.dto';
import { AdminGuard } from '../shared/guards/admin.guard';
import { AuthGuard } from '@nestjs/passport';

@ApiTags('System')
@Controller('admin/system')
@UseGuards(AuthGuard('jwt'), AdminGuard)
@ApiBearerAuth()
export class SystemController {
  private readonly logger = new Logger(SystemController.name);

  constructor(private readonly systemService: SystemService) {}

  @Get()
  @ApiOperation({ summary: 'Get all system variables' })
  @ApiResponse({ status: 200, description: 'Returns all system variables' })
  async findAll() {
    return this.systemService.findAll();
  }

  @Get(':key')
  @ApiOperation({ summary: 'Get specific system variable by key' })
  @ApiResponse({ status: 200, description: 'Returns system variable' })
  async findOne(@Param('key') key: string) {
    return this.systemService.findOne(key as any);
  }

  @Put('bot-token')
  @ApiOperation({ summary: 'Update Telegram bot token' })
  @ApiResponse({ status: 200, description: 'Bot token updated successfully' })
  async updateBotToken(@Body() dto: UpdateBotTokenDto) {
    return this.systemService.updateBotToken(dto);
  }

  @Put('aviator-chances')
  @ApiOperation({ summary: 'Update aviator multiplier chances configuration' })
  @ApiResponse({
    status: 200,
    description: 'Aviator chances updated successfully',
  })
  async updateAviatorChances(@Body() dto: UpdateAviatorChancesDto) {
    return this.systemService.updateAviatorChances(dto);
  }

  @Put('webapp-url')
  @ApiOperation({ summary: 'Update WebApp URL' })
  @ApiResponse({ status: 200, description: 'WebApp URL updated successfully' })
  async updateWebAppUrl(@Body() dto: UpdateWebAppUrlDto) {
    return this.systemService.updateWebAppUrl(dto.url);
  }
}
