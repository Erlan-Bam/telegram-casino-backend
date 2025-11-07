import { IsString, IsInt, Min, IsUrl } from 'class-validator';

export class CreatePrizeDto {
  @IsString()
  name: string;

  @IsInt()
  @Min(0)
  amount: number;

  @IsUrl()
  url: string;
}
