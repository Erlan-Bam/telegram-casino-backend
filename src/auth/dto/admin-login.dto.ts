import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({
    description: 'Admin login',
    example: 'superadmin',
  })
  @IsString()
  login: string;

  @ApiProperty({
    description: 'Admin password',
    example: 'Admin@2024!SecurePass',
  })
  @IsString()
  @MinLength(6)
  password: string;
}
