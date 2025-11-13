import { IsNumber, IsPositive } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class InitiateTonPaymentDto {
  @ApiProperty({
    description: 'Payment amount in USD',
    example: 10.99,
    minimum: 0.01,
  })
  @IsNumber()
  @IsPositive()
  amount: number;
}
