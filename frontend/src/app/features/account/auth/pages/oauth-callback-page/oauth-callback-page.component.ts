import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';

import { ActivatedRoute, Router, RouterLink } from '@angular/router';

import { finalize } from 'rxjs';

import type { MfaChallengeDetails } from '../../../../../core/auth/auth.models';

import { AuthApiService } from '../../../../../core/auth/auth-api.service';

import { OAuthBrowserService } from '../../../../../core/auth/oauth-browser.service';

import { AuthStore } from '../../../../../core/auth/auth.store';

import { getApiErrorMessage } from '../../../../../core/http/api-error.util';

import { BrandLogoComponent } from '../../../../../shared/components/brand-logo/brand-logo.component';

import { AuthDialogComponent } from '../../ui/auth-dialog/auth-dialog.component';

type OAuthCallbackStatus = 'loading' | 'mfa' | 'error';

@Component({
  selector: 'app-oauth-callback-page',

  standalone: true,

  imports: [RouterLink, BrandLogoComponent, AuthDialogComponent],

  templateUrl: './oauth-callback-page.component.html',

  styleUrl: './oauth-callback-page.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OAuthCallbackPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);

  private readonly router = inject(Router);

  private readonly api = inject(AuthApiService);

  private readonly oauth = inject(OAuthBrowserService);

  protected readonly auth = inject(AuthStore);

  protected readonly status = signal<OAuthCallbackStatus>('loading');

  protected readonly errorMessage = signal('');

  protected readonly challenge = signal<MfaChallengeDetails | null>(null);

  ngOnInit(): void {
    const handoff = this.route.snapshot.queryParamMap.get('handoff')?.trim() ?? '';

    if (!handoff) {
      this.fail('Không tìm thấy phiên hoàn tất OAuth.');

      return;
    }

    this.api.finalizeOAuth(handoff).subscribe({
      next: (result) => {
        switch (result.status) {
          case 'success':
            this.restoreSession();
            return;

          case 'mfa':
            this.challenge.set(result.challenge);

            this.status.set('mfa');

            return;

          case 'error':
            this.fail(result.message);

            return;
        }
      },

      error: (error: unknown) => {
        this.fail(
          getApiErrorMessage(
            error,

            'Không thể hoàn tất đăng nhập OAuth.',
          ),
        );
      },
    });
  }

  protected handleMfaDialogClosed(): void {
    /*
     * AuthDialog chỉ authenticated sau
     * confirm/verify MFA thành công.
     */
    if (this.auth.isAuthenticated()) {
      this.completeNavigation();

      return;
    }

    this.challenge.set(null);

    this.fail('Đăng nhập OAuth chưa được hoàn tất.');
  }

  private restoreSession(): void {
    /*
     * Callback backend đã set
     * refresh cookie HttpOnly.
     *
     * Frontend dùng refresh endpoint
     * để lấy access token vào memory.
     */
    this.auth
      .refreshSession()
      .pipe(
        finalize(() => {
          /*
           * Không xử lý gì ở đây.
           * next/error chịu trách nhiệm UI.
           */
        }),
      )
      .subscribe({
        next: () => {
          this.completeNavigation();
        },

        error: (error: unknown) => {
          this.fail(
            getApiErrorMessage(
              error,

              'Không thể khôi phục phiên đăng nhập OAuth.',
            ),
          );
        },
      });
  }

  private completeNavigation(): void {
    const returnUrl = this.oauth.consumeReturnUrl();

    void this.router.navigateByUrl(returnUrl);
  }

  private fail(message: string): void {
    this.status.set('error');

    this.errorMessage.set(message);
  }
}
