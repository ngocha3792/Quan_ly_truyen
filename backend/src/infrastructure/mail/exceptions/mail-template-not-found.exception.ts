export class MailTemplateNotFoundException extends Error {
  constructor(templateId: string) {
    super(`Mail template "${templateId}" was not found`);
    this.name = MailTemplateNotFoundException.name;
  }
}
