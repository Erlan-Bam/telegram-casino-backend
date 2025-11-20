import { ApiProperty } from '@nestjs/swagger';

export class LeaderboardUserDto {
  @ApiProperty({
    description: 'Position in leaderboard',
    example: 1,
  })
  position: number;

  @ApiProperty({
    description: 'User ID',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  userId: string;

  @ApiProperty({
    description: 'Username',
    example: 'Wo_n_il',
  })
  username: string;

  @ApiProperty({
    description: 'Total number of spins (case openings)',
    example: 978,
  })
  totalSpins: number;

  @ApiProperty({
    description: 'Total volume (sum of all bets)',
    example: 191922,
  })
  totalVolume: number;
}

export class LeaderboardResponseDto {
  @ApiProperty({
    description: 'Array of users in leaderboard',
    type: [LeaderboardUserDto],
  })
  leaderboard: LeaderboardUserDto[];
}
