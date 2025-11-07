import {
  IsString,
  IsInt,
  Min,
  IsUrl,
  IsArray,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CaseItemDto {
  @IsString()
  name: string;

  @IsInt()
  prizeId: number;

  @IsInt()
  @Min(0)
  chance: number;
}

export class CreateCaseDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  price: number;

  @IsUrl()
  preview: string;

  @IsArray()
  @ArrayMinSize(1, { message: 'At least one prize is required' })
  @ValidateNested({ each: true })
  @Type(() => CaseItemDto)
  items: CaseItemDto[];
}
