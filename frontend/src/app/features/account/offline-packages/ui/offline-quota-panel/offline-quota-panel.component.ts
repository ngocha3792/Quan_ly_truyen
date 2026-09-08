import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';
import {
  formatOfflineBytes,
  LocalStorageEstimate,
  OfflineQuota,
  offlineQuotaPercent,
} from '../../domain/offline-package.models';

@Component({
  selector: 'app-offline-quota-panel',
  standalone: true,
  imports: [IconComponent],
  templateUrl: './offline-quota-panel.component.html',
  styleUrl: './offline-quota-panel.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OfflineQuotaPanelComponent {
  readonly quota = input<OfflineQuota | null>(null);
  readonly localStorage = input<LocalStorageEstimate | null>(null);
  readonly online = input(true);
  readonly installable = input(false);
  readonly updateAvailable = input(false);
  readonly installRequested = output<void>();
  readonly updateRequested = output<void>();

  protected readonly formatBytes = formatOfflineBytes;
  protected readonly quotaPercent = offlineQuotaPercent;
}
