import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsEnum } from 'class-validator';
import { PaginationDto } from '../../shared/dto/pagination.dto';

export enum CaseSortBy {
  PRICE_ASC = 'price_asc',
  PRICE_DESC = 'price_desc',
  NAME_ASC = 'name_asc',
  NAME_DESC = 'name_desc',
  CREATED_ASC = 'created_asc',
  CREATED_DESC = 'created_desc',
}

export class GetCasesDto extends PaginationDto {
  @ApiPropertyOptional({
    description: 'Sort cases by field',
    enum: CaseSortBy,
    example: CaseSortBy.PRICE_ASC,
  })
  @IsOptional()
  @IsEnum(CaseSortBy)
  sortBy?: CaseSortBy = CaseSortBy.PRICE_ASC;
}
