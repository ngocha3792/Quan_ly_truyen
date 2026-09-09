import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { getApiErrorMessage } from '../../../../../core/http/api-error.util';
import { ButtonComponent } from '../../../../../shared/components/button/button.component';
import { AdminPaymentGatewayApiService } from '../../data-access/admin-payment-gateway-api.service';

@Component({
  selector: 'app-story-payment-rollout',
  imports: [FormsModule, ButtonComponent],
  templateUrl: './story-payment-rollout.component.html',
  styleUrl: './story-payment-rollout.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StoryPaymentRolloutComponent {
  private readonly api = inject(AdminPaymentGatewayApiService);
  protected storyId = '';
  protected loadedStoryId = '';
  protected enabled = false;
  protected vnpay = false;
  protected readonly busy = signal(false);
  protected readonly message = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);

  protected load(): void {
    if (this.busy() || !this.validId()) return;
    const id = this.storyId.trim();
    this.busy.set(true);
    this.error.set(null);
    this.message.set(null);
    this.loadedStoryId = '';
    this.api
      .allowlist(id)
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (result) => {
          this.enabled = result.isEnabled;
          this.vnpay = result.enabledProviders.includes('VNPAY');
          this.loadedStoryId = id;
        },
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể tải thiết lập truyện.')),
      });
  }

  protected save(): void {
    if (this.busy() || this.loadedStoryId !== this.storyId.trim()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api
      .saveAllowlist(this.loadedStoryId, {
        isEnabled: this.enabled,
        enabledProviders: this.vnpay ? ['VNPAY'] : [],
      })
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => this.message.set('Đã lưu phạm vi thanh toán cho truyện.'),
        error: (error: unknown) =>
          this.error.set(getApiErrorMessage(error, 'Không thể lưu thiết lập truyện.')),
      });
  }

  protected validId(): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      this.storyId.trim(),
    );
  }
}
