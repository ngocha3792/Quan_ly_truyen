import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { ButtonComponent } from '../../../../shared/components/button/button.component';
import {
  AI_AUTH_TYPE_LABELS,
  AI_CAPABILITY_KEYS,
  AI_CAPABILITY_LABELS,
  AI_PROTOCOL_LABELS,
  AI_PROVIDER_LABELS,
  AiConnection,
} from '../domain/admin-ai-settings.models';

@Component({
  selector: 'app-ai-connection-list',
  standalone: true,
  imports: [ButtonComponent],
  templateUrl: './ai-connection-list.component.html',
  styleUrl: './ai-connection-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiConnectionListComponent {
  readonly connections = input.required<readonly AiConnection[]>();
  readonly testingId = input<string | null>(null);
  readonly probingId = input<string | null>(null);
  readonly mutating = input(false);
  readonly test = output<AiConnection>();
  readonly browseModels = output<AiConnection>();
  readonly probe = output<AiConnection>();
  readonly edit = output<AiConnection>();
  readonly remove = output<AiConnection>();
  protected readonly labels = AI_PROVIDER_LABELS;
  protected readonly protocolLabels = AI_PROTOCOL_LABELS;
  protected readonly authLabels = AI_AUTH_TYPE_LABELS;
  protected readonly capabilityKeys = AI_CAPABILITY_KEYS;
  protected readonly capabilityLabels = AI_CAPABILITY_LABELS;
}
