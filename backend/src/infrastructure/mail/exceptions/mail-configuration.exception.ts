export class MailConfigurationException extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = MailConfigurationException.name;
  }
}
