import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { DecimalPipe } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';

import { AuthorStudioProfile, StudioIconName } from '../../domain/author-studio.models';
import { StudioIconComponent } from '../studio-icon/studio-icon.component';

interface StudioNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: StudioIconName;
  readonly badge?: number;
}

@Component({
  selector: 'app-studio-sidebar',
  standalone: true,

  imports: [DecimalPipe, RouterLink, RouterLinkActive, StudioIconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <aside class="studio-sidebar">
      <div class="studio-brand">
        <span class="brand-symbol">
          <span></span>
          <span></span>
        </span>

        <div>
          <strong>TruyenHub</strong>
          <small>Author Studio</small>
        </div>
      </div>

      <nav aria-label="Điều hướng Author Studio">
        @for (item of navigationItems; track item.label) {
          <a
            [routerLink]="item.route"
            routerLinkActive="active"
            [routerLinkActiveOptions]="{
              exact: item.route === '/author-studio/tong-quan',
            }"
            (click)="navigated.emit()"
          >
            <app-studio-icon [name]="item.icon" [size]="18"></app-studio-icon>

            <span>{{ item.label }}</span>

            @if (item.badge) {
              <small class="nav-badge">
                {{ item.badge }}
              </small>
            }
          </a>
        }
      </nav>

      <section class="author-profile-card">
        <div class="profile-avatar">
          <img [src]="profile.avatarUrl" [alt]="profile.displayName" />

          @if (profile.verified) {
            <span class="verified" title="Tác giả đã xác minh"> ✓ </span>
          }
        </div>

        <strong>
          {{ profile.displayName }}
        </strong>

        <small>
          {{ profile.penName }}
        </small>

        <div class="experience-heading">
          <span> Cấp độ {{ profile.level }} </span>

          <span>
            {{ profile.currentExperience | number }}
            /
            {{ profile.requiredExperience | number }}
            XP
          </span>
        </div>

        <div class="experience-track">
          <span [style.width.%]="experiencePercent"></span>
        </div>

        <a routerLink="/tai-khoan/thong-tin-ca-nhan" (click)="navigated.emit()">
          <app-studio-icon name="user" [size]="16"></app-studio-icon>

          Xem hồ sơ

          <app-studio-icon name="chevron-down" [size]="14"></app-studio-icon>
        </a>
      </section>
    </aside>
  `,

  styles: [
    `
      :host {
        display: block;
        min-height: 100%;
      }

      .studio-sidebar {
        position: sticky;
        top: 0;
        display: flex;
        height: 100vh;
        flex-direction: column;
        padding: 20px 12px 16px;
        overflow-y: auto;
        border-right: 1px solid rgba(128, 143, 180, 0.16);
        background:
          radial-gradient(circle at 30% 20%, rgba(111, 44, 196, 0.11), transparent 30%), #08111f;
      }

      .studio-brand {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 0 10px 24px;
      }

      .brand-symbol {
        position: relative;
        display: flex;
        width: 34px;
        height: 38px;
        gap: 2px;
      }

      .brand-symbol span {
        width: 50%;
        border-radius: 5px 2px 8px 3px;
        background: linear-gradient(180deg, #c054ff, #6d3bf3);
        box-shadow: 0 0 18px rgba(167, 71, 255, 0.3);
      }

      .brand-symbol span:first-child {
        transform: skewY(14deg);
      }

      .brand-symbol span:last-child {
        transform: skewY(-14deg);
      }

      .studio-brand div {
        display: grid;
        gap: 2px;
      }

      .studio-brand strong {
        color: #ffffff;
        font-size: 22px;
        letter-spacing: -0.7px;
      }

      .studio-brand small {
        color: #bd73ff;
        font-size: 13px;
        font-weight: 650;
      }

      nav {
        display: grid;
        gap: 4px;
      }

      nav a {
        display: grid;
        min-height: 44px;
        grid-template-columns: 23px minmax(0, 1fr) auto;
        align-items: center;
        gap: 10px;
        padding: 0 13px;
        border: 1px solid transparent;
        border-radius: 8px;
        color: #aeb7ca;
        font-size: 13px;
        text-decoration: none;
        transition:
          border-color 140ms ease,
          color 140ms ease,
          background 140ms ease;
      }

      nav a:hover {
        color: #ffffff;
        background: rgba(124, 58, 237, 0.1);
      }

      nav a.active {
        border-color: rgba(176, 112, 255, 0.2);
        background: linear-gradient(90deg, rgba(102, 51, 191, 0.45), rgba(74, 39, 143, 0.3));
        color: #d79cff;
      }

      .nav-badge {
        display: grid;
        min-width: 21px;
        height: 21px;
        place-items: center;
        padding: 0 6px;
        border-radius: 999px;
        background: #7c3aed;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
      }

      .author-profile-card {
        display: grid;
        justify-items: center;
        margin-top: auto;
        padding: 16px 14px 12px;
        border: 1px solid rgba(128, 143, 180, 0.17);
        border-radius: 10px;
        background: linear-gradient(145deg, rgba(17, 29, 52, 0.96), rgba(10, 20, 38, 0.96));
        text-align: center;
      }

      .profile-avatar {
        position: relative;
        width: 68px;
        height: 68px;
        margin-bottom: 10px;
        padding: 3px;
        border: 1px solid rgba(192, 132, 252, 0.58);
        border-radius: 50%;
        background: linear-gradient(135deg, #9d4edd, #4c1d95);
      }

      .profile-avatar img {
        width: 100%;
        height: 100%;
        border-radius: inherit;
        object-fit: cover;
      }

      .verified {
        position: absolute;
        right: -1px;
        bottom: 2px;
        display: grid;
        width: 17px;
        height: 17px;
        place-items: center;
        border: 2px solid #111d32;
        border-radius: 50%;
        background: #7c3aed;
        color: #ffffff;
        font-size: 9px;
        font-weight: 900;
      }

      .author-profile-card > strong {
        color: #ffffff;
        font-size: 15px;
      }

      .author-profile-card > small {
        margin-top: 4px;
        color: #939db3;
        font-size: 11px;
      }

      .experience-heading {
        display: flex;
        width: 100%;
        justify-content: space-between;
        margin-top: 14px;
        color: #aeb7c9;
        font-size: 9px;
      }

      .experience-track {
        width: 100%;
        height: 5px;
        margin-top: 7px;
        overflow: hidden;
        border-radius: 999px;
        background: rgba(117, 128, 157, 0.18);
      }

      .experience-track span {
        display: block;
        height: 100%;
        border-radius: inherit;
        background: linear-gradient(90deg, #7c3aed, #c05cff);
      }

      .author-profile-card > a {
        display: grid;
        width: 100%;
        min-height: 36px;
        grid-template-columns: 20px minmax(0, 1fr) 16px;
        align-items: center;
        gap: 7px;
        margin-top: 16px;
        padding: 0 12px;
        border: 1px solid rgba(130, 145, 184, 0.22);
        border-radius: 7px;
        background: rgba(20, 32, 57, 0.6);
        color: #e8e5ef;
        font-size: 11px;
        text-decoration: none;
      }

      @media (max-width: 900px) {
        .studio-sidebar {
          position: static;
          height: 100%;
        }
      }
    `,
  ],
})
export class StudioSidebarComponent {
  @Input({ required: true })
  profile!: AuthorStudioProfile;

  @Input()
  unreadNotifications = 0;

  @Output()
  readonly navigated = new EventEmitter<void>();

  protected readonly navigationItems: readonly StudioNavigationItem[] = [
    {
      label: 'Tổng quan',
      route: '/author-studio/tong-quan',
      icon: 'home',
    },
    {
      label: 'Truyện của tôi',
      route: '/author-studio/truyen',
      icon: 'book',
    },
    {
      label: 'Hồ sơ tác giả',
      route: '/author-studio/ho-so',
      icon: 'user',
    },
    {
      label: 'Thống kê',
      route: '/author-studio/thong-ke',
      icon: 'chart',
    },
  ];

  protected get experiencePercent(): number {
    if (!this.profile.requiredExperience) {
      return 0;
    }

    return Math.min(
      100,
      Math.round((this.profile.currentExperience / this.profile.requiredExperience) * 100),
    );
  }
}
