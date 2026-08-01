import { IsEmail, IsString, Length, Matches } from 'class-validator';

import {
  IsStrongPassword,
  NormalizeEmail,
  Trim,
} from '@/common/decorators/validation';

export class RegisterDto {
  @NormalizeEmail()
  @IsEmail()
  @Length(3, 320)
  email!: string;

  @Trim()
  @IsString()
  @Length(3, 50)
  @Matches(/^[A-Za-z0-9_]+$/)
  username!: string;

  @IsString()
  @IsStrongPassword()
  password!: string;

  @Trim()
  @IsString()
  @Length(1, 120)
  displayName!: string;
}

export interface RegisterResponseDto {
  id: string;
  email: string;
  username: string;
  displayName: string;
  verificationRequired: true;
}
