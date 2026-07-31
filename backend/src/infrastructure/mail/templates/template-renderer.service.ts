import { Injectable } from '@nestjs/common';

import type { RenderedMailTemplate } from '../contracts';
import { MailTemplateRegistry } from './mail-template-registry';

@Injectable()
export class TemplateRendererService {
  constructor(private readonly registry: MailTemplateRegistry) {}

  render(
    templateId: string,
    variables: Record<string, unknown>,
  ): RenderedMailTemplate {
    return this.registry.get(templateId).render(variables);
  }
}
