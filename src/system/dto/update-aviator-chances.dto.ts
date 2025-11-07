import { ApiProperty } from '@nestjs/swagger';
import { IsArray, ValidateNested, ArrayMinSize } from 'class-validator';
import { Type } from 'class-transformer';
import { AviatorRangeDto } from './aviator-range.dto';

export class UpdateAviatorChancesDto {
  @ApiProperty({
    description: 'Array of aviator multiplier ranges with chances',
    type: [AviatorRangeDto],
    example: [
      { from: 1, to: 2, chance: 70 },
      { from: 2, to: 5, chance: 20 },
      { from: 5, to: 10, chance: 8 },
      { from: 10, to: 20, chance: 2 },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => AviatorRangeDto)
  ranges: AviatorRangeDto[];
}
