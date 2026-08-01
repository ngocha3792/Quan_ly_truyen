import { Body, Controller, Post } from '@nestjs/common';

import { Public } from '@/common/decorators/auth';
import { Idempotent } from '@/common/decorators/interceptor';

import { RegisterDto, type RegisterResponseDto } from './dto/register.dto';
import { RegistrationService } from './services/registration.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly registrationService: RegistrationService) {}

  @Post('register')
  @Public()
  @Idempotent({ required: true, ttlSeconds: 86_400 })
  register(@Body() dto: RegisterDto): Promise<RegisterResponseDto> {
    return this.registrationService.register(dto);
  }
}
