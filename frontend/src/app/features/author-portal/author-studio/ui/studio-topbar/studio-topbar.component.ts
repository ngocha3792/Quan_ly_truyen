import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StudioIconComponent } from '../studio-icon/studio-icon.component';

@Component({
  selector: 'app-studio-topbar',
  standalone: true,

  imports: [RouterLink, StudioIconComponent],

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <header class="studio-topbar">
      <button
        class="mobile-menu-button"
        type="button"
        aria-label="Mở menu"
        (click)="menuRequested.emit()"
      >
        <app-studio-icon name="menu" [size]="20"></app-studio-icon>
      </button>


      <a class="notification-button" routerLink="/thong-bao" aria-label="Thông báo">
        <app-studio-icon name="bell" [size]="21"></app-studio-icon>

        @if (unreadNotifications > 0) {
          <span>
            {{ unreadNotifications }}
          </span>
        }
      </a>

      <a class="create-story-button" routerLink="/author-studio/truyen/tao-moi">
        <app-studio-icon name="plus" [size]="18"></app-studio-icon>

        Tạo truyện mới
      </a>
    </header>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .studio-topbar {
        display: flex;
        min-height: 72px;
        align-items: center;
        justify-content: flex-end;
        gap: 14px;
        padding: 14px 24px;
        border-bottom: 1px solid var(--border);
        background: rgba(8, 17, 31, 0.94);
        backdrop-filter: blur(16px);
      }

      .mobile-menu-button {
        display: none;
        width: 42px;
        height: 42px;
        place-items: center;
        border: 1px solid var(--border);
        border-radius: 8px;
        background: #111d31;
        color: #c5cddd;
        cursor: pointer;
      }

      .studio-search {
        width: min(340px, 36vw);

        --search-min-height: 44px;

        --search-input-height: 42px;

        --search-radius: 999px;

        --search-border: 1px solid var(--border);

        --search-background: rgba(7, 13, 27, 0.72);

        --search-padding: 0 16px;

        --search-gap: 8px;

        --search-color: var(--text-strong);

        --search-font-size: 13.5px;

        --search-icon-color: var(--text-muted);

        --search-placeholder-color: var(--text-muted);
      }
      .notification-button {
        position: relative;
        display: grid;
        width: 44px;
        height: 44px;
        place-items: center;
        border-left: 1px solid var(--border);
        color: #d8deea;
        text-decoration: none;
      }

      .notification-button span {
        position: absolute;
        top: -1px;
        right: -2px;
        display: grid;
        min-width: 18px;
        height: 18px;
        place-items: center;
        padding: 0 4px;
        border: 2px solid #08111f;
        border-radius: 999px;
        background: #ef4444;
        color: #ffffff;
        font-size: 10px;
        font-weight: 800;
      }

      .create-story-button {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 20px;
        border: 1px solid rgba(220, 186, 255, 0.23);
        border-radius: 8px;
        background: linear-gradient(135deg, #9d43ef, #6e31da);
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        text-decoration: none;
        box-shadow: 0 8px 24px rgba(114, 46, 208, 0.25);
      }

      @media (max-width: 900px) {
        .studio-topbar {
          justify-content: space-between;
          padding: 12px 15px;
        }

        .mobile-menu-button {
          display: grid;
        }

        .studio-search {
          margin-left: auto;
        }
      }

      @media (max-width: 600px) {
        .studio-search {
          display: none;
        }

        .create-story-button {
          padding: 0 14px;
          font-size: 12px;
        }
      }
    `,
  ],
})
export class StudioTopbarComponent {
  @Input()
  unreadNotifications = 0;

  @Output()
  readonly menuRequested = new EventEmitter<void>();
}
