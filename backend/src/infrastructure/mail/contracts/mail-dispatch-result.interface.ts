export type MailDispatchResult =
  | {
      status: 'sent';
      messageId: string;
      accepted: readonly string[];
    }
  | {
      status: 'skipped';
      reason: 'mail-disabled';
    };
