import {
  IsString,
  IsInt,
  Min,
  IsUrl,
  IsOptional,
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

export class UpdateCaseDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsUrl()
  preview?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one prize is required' })
  @ValidateNested({ each: true })
  @Type(() => CaseItemDto)
  items?: CaseItemDto[];
}
