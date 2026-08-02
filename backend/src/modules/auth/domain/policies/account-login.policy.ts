import { AuthAccountStatus } from '../enums';
import {
  AccountLoginUnavailableException,
  EmailNotVerifiedException,
} from '../exceptions';

export interface AccountLoginPolicyInput {
  status: AuthAccountStatus;
  deletedAt: Date | null;
  emailVerifiedAt: Date | null;
}

export class AccountLoginPolicy {
  static assertCanLogin(input: AccountLoginPolicyInput): void {
    if (input.deletedAt !== null || input.status !== AuthAccountStatus.ACTIVE) {
      throw new AccountLoginUnavailableException();
    }

    if (input.emailVerifiedAt === null) {
      throw new EmailNotVerifiedException();
    }
  }
}
