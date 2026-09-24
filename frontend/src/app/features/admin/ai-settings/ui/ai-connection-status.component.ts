import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { IconComponent } from '../../../../shared/components/icon/icon.component';
import { AI_PROVIDER_LABELS, AiConnection } from '../domain/admin-ai-settings.models';

@Component({
  selector: 'app-ai-connection-status',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './ai-connection-status.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AiConnectionStatusComponent {
  readonly connections = input.required<readonly AiConnection[]>();
  protected readonly labels = AI_PROVIDER_LABELS;
  protected readonly enabledCount = computed(
    () => this.connections().filter((connection) => connection.enabled).length,
  );
}
