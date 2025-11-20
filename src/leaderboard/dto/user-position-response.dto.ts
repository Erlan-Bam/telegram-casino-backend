import { ApiProperty } from '@nestjs/swagger';

export class UserPositionResponseDto {
  @ApiProperty({
    description: 'User position in volume leaderboard',
    example: 5,
  })
  volumePosition: number;

  @ApiProperty({
    description: 'User position in spins leaderboard',
    example: 12,
  })
  spinsPosition: number;

  @ApiProperty({
    description: 'Total spins count',
    example: 456,
  })
  totalSpins: number;

  @ApiProperty({
    description: 'Total volume',
    example: 123456,
  })
  totalVolume: number;
}
