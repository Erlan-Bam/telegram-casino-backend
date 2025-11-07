import { IsString, IsInt, Min, IsUrl, IsOptional } from 'class-validator';

export class UpdatePrizeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsUrl()
  url?: string;
}
