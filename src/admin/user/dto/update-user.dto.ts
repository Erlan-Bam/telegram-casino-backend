import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({
    description: 'Balance of the user',
    example: 1000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  balance?: number;

  @ApiPropertyOptional({
    description: 'Ban status of the user',
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isBanned?: boolean;
}
