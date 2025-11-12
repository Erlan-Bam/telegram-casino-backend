import { ApiProperty } from '@nestjs/swagger';
import {
  IsNumber,
  IsPositive,
  IsInt,
  Min,
  Max,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateUpgradeChanceDto {
  @ApiProperty({
    description: 'ID of upgrade chance to update',
    example: 1,
  })
  @Type(() => Number)
  @IsInt()
  @IsPositive()
  id: number;

  @ApiProperty({
    description: 'New multiplier value (optional)',
    example: 2,
    required: false,
  })
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  @IsOptional()
  multiplier?: number;

  @ApiProperty({
    description: 'Success chance as decimal (0.0 - 1.0)',
    example: 0.5,
    minimum: 0,
    maximum: 1,
  })
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  chance: number;
}
