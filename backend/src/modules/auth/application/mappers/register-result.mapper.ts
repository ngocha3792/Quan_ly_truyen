import type { RegisterResultDto } from '../dto';
import type { RegistrationUnitOfWorkResult } from '../ports';

export class RegisterResultMapper {
  static toDto(input: RegistrationUnitOfWorkResult): RegisterResultDto {
    return {
      id: input.id,
      email: input.email,
      username: input.username,
      displayName: input.displayName,
      verificationRequired: true,
    };
  }
}
