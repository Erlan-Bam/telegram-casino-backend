import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsUrl } from 'class-validator';

export class UpdateWebAppUrlDto {
  @ApiProperty({
    description: 'WebApp URL',
    example: 'https://your-webapp.com',
  })
  @IsString()
  @IsNotEmpty()
  @IsUrl()
  url: string;
}
