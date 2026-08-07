import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../../shared/components/icon/icon.component';

import { ProfileCompletion } from '../../domain/account-profile.models';

@Component({
  selector: 'app-profile-completion-card',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="completion-card">
      <div class="completion-title">
        <strong>Mức độ hồ sơ</strong>

        <app-icon name="info" [size]="15" />
      </div>

      <div class="progress-ring" [style.background]="ringBackground()">
        <div class="ring-inner">
          <strong> {{ completion().percent }}% </strong>

          <span>Hoàn thiện</span>
        </div>
      </div>

      <p class="message">
        {{ completion().message }}
      </p>

      <div class="progress-bar">
        <span [style.width.%]="completion().percent"></span>
      </div>

      <div class="completion-list">
        @for (item of completion().items; track item.label) {
          <div class="completion-item">
            <span class="item-icon">
              <app-icon [name]="item.completed ? 'check' : 'close'" [size]="13" />
            </span>

            <div>
              <strong>
                {{ item.label }}
              </strong>

              <small>
                {{ item.description }}
              </small>
            </div>
          </div>
        }
      </div>

      <a class="view-profile-button" routerLink="/tai-khoan">
        <app-icon name="user" [size]="16" />

        Xem tổng quan tài khoản
      </a>
    </aside>
  `,
  styles: `
    .completion-card {
      padding: 22px 20px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: linear-gradient(145deg, rgba(16, 24, 42, 0.98), rgba(10, 16, 31, 0.98));
    }

    .completion-title {
      display: flex;
      align-items: center;
      gap: 7px;
      color: #f8fafc;
      font-size: 14.5px;
      font-weight: 700;
    }

    .completion-title app-icon {
      color: #94a3b8;
    }

    .progress-ring {
      width: 126px;
      height: 126px;
      margin: 24px auto 14px;
      padding: 8px;
      border-radius: 50%;
    }

    .ring-inner {
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      align-content: center;
      gap: 4px;
      border-radius: 50%;
      background: #11192b;
    }

    .ring-inner strong {
      color: #f8fafc;
      font-size: 28px;
      font-weight: 700;
    }

    .ring-inner span {
      color: #94a3b8;
      font-size: 12px;
    }

    .message {
      margin: 0;
      text-align: center;
      color: #94a3b8;
      font-size: 12.5px;
    }

    .progress-bar {
      height: 6px;
      margin: 19px 0 23px;
      overflow: hidden;
      border-radius: 20px;
      background: #252d41;
    }

    .progress-bar span {
      height: 100%;
      display: block;
      border-radius: inherit;
      background: linear-gradient(90deg, #733bdf, #b35cf3);
    }

    .completion-list {
      display: grid;
      gap: 17px;
    }

    .completion-item {
      display: grid;
      grid-template-columns: auto 1fr;
      align-items: center;
      gap: 11px;
    }

    .item-icon {
      width: 22px;
      height: 22px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #4ade80;
      background: rgba(34, 197, 94, 0.18);
    }

    .completion-item div {
      display: grid;
      gap: 3px;
    }

    .completion-item strong {
      color: #f8fafc;
      font-size: 13.5px;
      font-weight: 600;
    }

    .completion-item small {
      color: #94a3b8;
      font-size: 12px;
    }

    .view-profile-button {
      min-height: 42px;
      margin-top: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      border: 1px solid #7543c7;
      border-radius: 7px;
      color: #c084fc;
      font-size: 13px;
      font-weight: 650;
      text-decoration: none;
    }

    .view-profile-button:hover {
      color: #fff;
      background: rgba(128, 70, 216, 0.14);
    }
  `,
})
export class ProfileCompletionCardComponent {
  readonly completion = input.required<ProfileCompletion>();

  readonly ringBackground = computed(() => {
    const percent = this.completion().percent;

    return [
      'conic-gradient(',
      '#9350ec 0%,',
      `#9350ec ${percent}%,`,
      'rgba(91, 102, 130, .2)',
      `${percent}%,`,
      'rgba(91, 102, 130, .2) 100%',
      ')',
    ].join(' ');
  });
}
