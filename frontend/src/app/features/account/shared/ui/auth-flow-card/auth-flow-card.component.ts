import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { IconComponent, IconName } from '../../../../../shared/components/icon/icon.component';

export type AuthFlowTone = 'default' | 'success' | 'warning' | 'danger';

@Component({
  selector: 'app-auth-flow-card',
  standalone: true,

  imports: [IconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="auth-card" [attr.data-tone]="tone()">
      <div class="decoration" aria-hidden="true">
        <span class="sparkle sparkle--one"> ✦ </span>

        <span class="sparkle sparkle--two"> ✦ </span>

        <span class="sparkle sparkle--three"> ✧ </span>
      </div>

      <div class="status-icon">
        <app-icon [name]="icon()" [size]="iconSize()" />

        @if (loading()) {
          <span class="loading-ring"></span>
        }
      </div>

      <span class="eyebrow">
        {{ eyebrow() }}
      </span>

      <h1>
        {{ title() }}
      </h1>

      @if (description()) {
        <p class="description">
          {{ description() }}
        </p>
      }

      <div class="content">
        <ng-content />
      </div>

      <ng-content select="[authFooter]" />
    </section>
  `,

  styles: `
    :host {
      display: block;
      width: 100%;
    }

    .auth-card {
      position: relative;

      width: min(var(--auth-card-width, 680px), 100%);

      margin: 0 auto;

      overflow: hidden;

      padding: var(--auth-card-padding, 40px 56px 36px);

      border: 1px solid var(--border);

      border-radius: 16px;

      text-align: center;

      isolation: isolate;

      background:
        radial-gradient(circle at 50% 14%, rgba(126, 34, 206, 0.12), transparent 28%),
        linear-gradient(145deg, rgba(16, 22, 39, 0.96), rgba(9, 15, 29, 0.98));

      box-shadow:
        0 28px 75px rgba(0, 0, 0, 0.22),
        inset 0 1px 0 rgba(255, 255, 255, 0.018);
    }

    .auth-card::before {
      position: absolute;

      top: -180px;
      left: 50%;

      z-index: -1;

      width: 430px;
      height: 300px;

      border-radius: 50%;

      content: '';

      background: rgba(126, 34, 206, 0.13);

      filter: blur(75px);

      transform: translateX(-50%);
    }

    .decoration {
      position: absolute;

      top: 42px;
      left: 50%;

      width: 280px;
      height: 100px;

      pointer-events: none;

      transform: translateX(-50%);
    }

    .sparkle {
      position: absolute;

      color: rgba(196, 132, 252, 0.62);

      line-height: 1;
    }

    .sparkle--one {
      top: 5px;
      left: 18px;

      font-size: 15px;
    }

    .sparkle--two {
      top: 28px;
      right: 8px;

      font-size: 11px;
    }

    .sparkle--three {
      bottom: 4px;
      left: 44px;

      font-size: 10px;
    }

    .status-icon {
      position: relative;

      width: 66px;
      height: 66px;

      margin: 0 auto 18px;

      display: grid;

      place-items: center;

      border: 1px solid rgba(168, 85, 247, 0.28);

      border-radius: 18px;

      color: #c084fc;

      background: rgba(126, 34, 206, 0.16);

      box-shadow: 0 14px 30px rgba(76, 29, 149, 0.16);
    }

    .auth-card[data-tone='success'] .status-icon {
      color: #4ade80;

      border-color: rgba(74, 222, 128, 0.25);

      background: rgba(22, 163, 74, 0.11);
    }

    .auth-card[data-tone='warning'] .status-icon {
      color: #fbbf24;

      border-color: rgba(251, 191, 36, 0.28);

      background: rgba(217, 119, 6, 0.1);
    }

    .auth-card[data-tone='danger'] .status-icon {
      color: #fb7185;

      border-color: rgba(251, 113, 133, 0.28);

      background: rgba(190, 24, 93, 0.1);
    }

    .loading-ring {
      position: absolute;

      inset: -6px;

      border: 2px solid rgba(192, 132, 252, 0.14);

      border-top-color: #c084fc;

      border-radius: 22px;

      animation: auth-ring 850ms linear infinite;
    }

    .eyebrow {
      display: block;

      margin-bottom: 9px;

      color: #a96df2;

      font-size: 10px;

      font-weight: 800;

      letter-spacing: 0.12em;
    }

    .auth-card[data-tone='success'] .eyebrow {
      color: #4ade80;
    }

    .auth-card[data-tone='warning'] .eyebrow {
      color: #fbbf24;
    }

    .auth-card[data-tone='danger'] .eyebrow {
      color: #fb7185;
    }

    h1 {
      margin: 0;

      color: #f8f6fb;

      font-size: clamp(1.65rem, 4vw, 2rem);

      line-height: 1.2;
    }

    .description {
      max-width: 510px;

      margin: 12px auto 0;

      color: #8d96aa;

      font-size: 13.5px;

      line-height: 1.7;
    }

    .content {
      margin-top: var(--auth-content-margin-top, 25px);
    }

    @keyframes auth-ring {
      to {
        transform: rotate(360deg);
      }
    }

    @media (max-width: 600px) {
      .auth-card {
        padding: 32px 20px 28px;
      }

      .status-icon {
        width: 58px;
        height: 58px;

        border-radius: 15px;
      }
    }
  `,
})
export class AuthFlowCardComponent {
  readonly icon = input.required<IconName>();

  readonly iconSize = input(29);

  readonly eyebrow = input.required<string>();

  readonly title = input.required<string>();

  readonly description = input('');

  readonly tone = input<AuthFlowTone>('default');

  readonly loading = input(false);
}
