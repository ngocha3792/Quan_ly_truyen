import { InvalidInputException } from '@/common/exceptions';

export class NewEmailMustDifferException extends InvalidInputException {
  constructor() {
    super({
      code: 'AUTH_NEW_EMAIL_MUST_DIFFER',

      message: 'Email mới phải khác email hiện tại',

      details: {
        field: 'newEmail',
      },
    });
  }
}
