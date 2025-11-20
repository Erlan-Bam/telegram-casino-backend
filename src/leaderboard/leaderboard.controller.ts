import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { LeaderboardService } from './leaderboard.service';
import { User } from '../shared/decorator/user.decorator';
import { LeaderboardResponseDto } from './dto/leaderboard-response.dto';
import { UserPositionResponseDto } from './dto/user-position-response.dto';

@ApiTags('Leaderboard')
@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Get('volume')
  @ApiOperation({ summary: 'Get leaderboard sorted by total volume' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of users to return (default: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns leaderboard sorted by volume',
    type: LeaderboardResponseDto,
  })
  async getLeaderboardByVolume(
    @Query('limit') limit?: string,
  ): Promise<LeaderboardResponseDto> {
    const parsedLimit = limit ? parseInt(limit) : 100;
    return this.leaderboardService.getLeaderboardByVolume(parsedLimit);
  }

  @Get('spins')
  @ApiOperation({ summary: 'Get leaderboard sorted by total spins' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of users to return (default: 100)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns leaderboard sorted by spins',
    type: LeaderboardResponseDto,
  })
  async getLeaderboardBySpins(
    @Query('limit') limit?: string,
  ): Promise<LeaderboardResponseDto> {
    const parsedLimit = limit ? parseInt(limit) : 100;
    return this.leaderboardService.getLeaderboardBySpins(parsedLimit);
  }

  @Get('my-position')
  @UseGuards(AuthGuard('jwt'))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user position in leaderboards' })
  @ApiResponse({
    status: 200,
    description: 'Returns user positions in both leaderboards',
    type: UserPositionResponseDto,
  })
  async getMyPosition(
    @User('id') userId: string,
  ): Promise<UserPositionResponseDto> {
    return this.leaderboardService.getUserPosition(userId);
  }
}
