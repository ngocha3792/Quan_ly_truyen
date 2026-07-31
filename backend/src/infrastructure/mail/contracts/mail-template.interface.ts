export interface RenderedMailTemplate {
  subject: string;
  text: string;
  html: string;
  tags?: readonly string[];
}

export interface MailTemplate {
  readonly id: string;
  render(variables: Record<string, unknown>): RenderedMailTemplate;
}
