import { ApiProperty } from '@nestjs/swagger';
import { IsNumber, IsDecimal, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AviatorRangeDto {
  @ApiProperty({ description: 'Range start (inclusive)', example: 1 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  from: number;

  @ApiProperty({ description: 'Range end (exclusive)', example: 2 })
  @IsNumber()
  @Min(0)
  @Type(() => Number)
  to: number;

  @ApiProperty({ description: 'Chance percentage (0-100)', example: 70 })
  @IsNumber()
  @Min(0)
  @Max(100)
  @Type(() => Number)
  chance: number;
}
