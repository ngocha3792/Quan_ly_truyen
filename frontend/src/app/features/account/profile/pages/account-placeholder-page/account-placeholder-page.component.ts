import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { ActivatedRoute, RouterLink } from '@angular/router';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-account-placeholder-page',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="page-header">
      <h1>{{ title }}</h1>

      <p>{{ description }}</p>
    </header>

    <section class="placeholder-card">
      <div class="icon">
        <app-icon name="sparkles" [size]="28" />
      </div>

      <h2>{{ title }}</h2>

      <p>
        Cấu trúc route và layout đã sẵn sàng. Phần form và nghiệp vụ sẽ được đặt riêng trong module
        này.
      </p>

      <a routerLink="/tai-khoan"> Quay về tổng quan </a>
    </section>
  `,
  styles: `
    .page-header {
      margin: 3px 0 20px;
    }

    .page-header h1 {
      margin: 0;
      color: #f6f4fa;
      font-size: 26px;
    }

    .page-header p {
      margin: 8px 0 0;
      color: #818a9d;
      font-size: 13px;
    }

    .placeholder-card {
      min-height: 390px;
      padding: 40px;
      display: grid;
      place-items: center;
      align-content: center;
      text-align: center;
      border: 1px solid var(--border);
      border-radius: 14px;
      background: linear-gradient(145deg, rgba(15, 22, 39, 0.96), rgba(9, 14, 27, 0.96));
    }

    .icon {
      width: 64px;
      height: 64px;
      display: grid;
      place-items: center;
      border-radius: 18px;
      color: #c285ff;
      background: rgba(123, 61, 204, 0.2);
    }

    h2 {
      margin: 20px 0 8px;
      color: #f5f3fa;
    }

    .placeholder-card p {
      max-width: 470px;
      margin: 0;
      color: #818b9f;
      font-size: 13px;
      line-height: 1.7;
    }

    a {
      min-height: 40px;
      margin-top: 22px;
      padding: 0 17px;
      display: inline-flex;
      align-items: center;
      border-radius: 7px;
      color: #fff;
      font-size: 12px;
      font-weight: 750;
      text-decoration: none;
      background: linear-gradient(135deg, #753ce0, #9850e7);
    }
  `,
})
export class AccountPlaceholderPageComponent {
  private readonly route = inject(ActivatedRoute);

  protected readonly title = String(this.route.snapshot.data['title'] ?? 'Quản lý tài khoản');

  protected readonly description = String(this.route.snapshot.data['description'] ?? '');
}
