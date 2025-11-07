import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class UpdateBotTokenDto {
  @ApiProperty({
    description: 'Telegram bot token',
    example: '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11',
  })
  @IsString()
  @IsNotEmpty()
  token: string;
}
