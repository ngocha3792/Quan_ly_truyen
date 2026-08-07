import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { AuthorProfile } from '../../domain/author-detail.models';

@Component({
  selector: 'app-author-hero',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <section class="author-hero">
      <div class="hero-landscape" aria-hidden="true">
        <span class="moon"></span>
        <span class="mountain mountain--1"></span>
        <span class="mountain mountain--2"></span>
        <span class="mountain mountain--3"></span>
        <span class="pagoda"></span>
      </div>

      <div class="author-avatar">
        <span>{{ profile.initials }}</span>

        @if (profile.verified) {
          <span class="verified-badge" title="Tác giả đã xác minh">
            <svg viewBox="0 0 24 24">
              <path
                d="m12 2 2.1 2.2 3-.3.9 2.9 2.7 1.5-1.2 2.8 1.2 2.8-2.7 1.5-.9 2.9-3-.3L12 22l-2.1-2.2-3 .3-.9-2.9-2.7-1.5 1.2-2.8-1.2-2.8L6 8.6l.9-2.9 3 .3L12 2Z"
              ></path>

              <path d="m8.5 12 2.2 2.2 4.8-4.8"></path>
            </svg>
          </span>
        }
      </div>

      <div class="author-information">
        <div class="author-name-row">
          <h1>{{ profile.name }}</h1>

          @if (profile.verified) {
            <span class="verified-inline">
              <svg viewBox="0 0 24 24">
                <path
                  d="m12 2 2.1 2.2 3-.3.9 2.9 2.7 1.5-1.2 2.8 1.2 2.8-2.7 1.5-.9 2.9-3-.3L12 22l-2.1-2.2-3 .3-.9-2.9-2.7-1.5 1.2-2.8-1.2-2.8L6 8.6l.9-2.9 3 .3L12 2Z"
                ></path>

                <path d="m8.5 12 2.2 2.2 4.8-4.8"></path>
              </svg>
            </span>
          }
        </div>

        <p class="headline">
          {{ profile.headline }}
        </p>

        <div class="author-meta">
          <span>
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9"></circle>
              <path d="M3 12h18"></path>
              <path d="M12 3a15 15 0 0 1 0 18"></path>
              <path d="M12 3a15 15 0 0 0 0 18"></path>
            </svg>

            Quốc gia:
            <strong>{{ profile.country }}</strong>
          </span>

          <span>
            <svg viewBox="0 0 24 24">
              <path d="m4 20 4.5-1 10-10a2.1 2.1 0 0 0-3-3l-10 10L4 20Z"></path>
              <path d="m14 7 3 3"></path>
            </svg>

            Bút danh:
            <strong>{{ profile.penName }}</strong>
          </span>

          <span>
            <svg viewBox="0 0 24 24">
              <rect x="3" y="5" width="18" height="16" rx="2"></rect>
              <path d="M16 3v4"></path>
              <path d="M8 3v4"></path>
              <path d="M3 10h18"></path>
            </svg>

            Gia nhập:
            <strong>{{ profile.joinedAt }}</strong>
          </span>
        </div>

        <div class="hero-actions">
          <button
            class="follow-button"
            type="button"
            [class.follow-button--active]="following"
            (click)="followToggle.emit()"
          >
            <svg viewBox="0 0 24 24">
              @if (following) {
                <path d="m5 12 4 4L19 6"></path>
              } @else {
                <path d="M12 5v14"></path>
                <path d="M5 12h14"></path>
              }
            </svg>

            {{ following ? 'Đang theo dõi' : 'Theo dõi tác giả' }}
          </button>

          <span class="followers">
            <svg viewBox="0 0 24 24">
              <circle cx="9" cy="8" r="3"></circle>
              <path d="M3.5 19c.5-3.4 2.3-5 5.5-5s5 1.6 5.5 5"></path>
              <path d="M16 6a3 3 0 0 1 0 5"></path>
              <path d="M16.5 14c2.3.4 3.6 2 4 4.5"></path>
            </svg>

            {{ followerLabel }}
          </span>
        </div>
      </div>
    </section>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .author-hero {
        position: relative;
        display: grid;
        min-height: 200px;
        grid-template-columns: 170px minmax(0, 1fr);
        align-items: center;
        gap: 24px;
        overflow: hidden;
        padding: 1.5rem 1.75rem;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(16, 22, 39, 0.9), rgba(10, 15, 28, 0.92));
        box-shadow: 0 14px 35px rgba(0, 0, 0, 0.15);
        isolation: isolate;
      }

      .hero-landscape {
        position: absolute;
        inset: 0;
        z-index: -1;
        overflow: hidden;
        pointer-events: none;
      }

      .hero-landscape::before {
        position: absolute;
        inset: 0;
        content: '';
        background:
          radial-gradient(circle at 73% 24%, rgba(140, 77, 232, 0.18), transparent 28%),
          linear-gradient(90deg, transparent 28%, rgba(23, 18, 51, 0.2) 50%, rgba(17, 15, 43, 0.52));
      }

      .moon {
        position: absolute;
        top: 28px;
        right: 160px;
        width: 122px;
        height: 122px;
        border-radius: 50%;
        background: radial-gradient(
          circle at 35% 30%,
          #d8c8ff,
          #7b61c9 48%,
          rgba(89, 65, 150, 0.12) 70%
        );
        box-shadow: 0 0 80px rgba(168, 85, 247, 0.35);
        opacity: 0.35;
      }

      .mountain {
        position: absolute;
        right: -40px;
        bottom: -85px;
        width: 600px;
        height: 250px;
        background: rgba(7, 12, 27, 0.74);
        clip-path: polygon(
          0 100%,
          10% 63%,
          20% 75%,
          31% 35%,
          42% 68%,
          54% 25%,
          65% 58%,
          77% 17%,
          89% 55%,
          100% 31%,
          100% 100%
        );
      }

      .mountain--2 {
        right: 260px;
        bottom: -112px;
        transform: scale(0.86);
        opacity: 0.58;
      }

      .mountain--3 {
        right: -170px;
        bottom: -125px;
        transform: scale(1.22);
        opacity: 0.45;
      }

      .pagoda {
        position: absolute;
        right: 205px;
        bottom: 28px;
        width: 38px;
        height: 84px;
        background: linear-gradient(
          90deg,
          transparent 38%,
          rgba(5, 8, 17, 0.8) 38%,
          rgba(5, 8, 17, 0.8) 62%,
          transparent 62%
        );
        opacity: 0.75;
      }

      .pagoda::before,
      .pagoda::after {
        position: absolute;
        left: 50%;
        content: '';
        transform: translateX(-50%);
        border-right: 28px solid transparent;
        border-bottom: 13px solid rgba(5, 8, 17, 0.88);
        border-left: 28px solid transparent;
      }

      .pagoda::before {
        top: 10px;
      }

      .pagoda::after {
        top: 38px;
      }

      .author-avatar {
        position: relative;
        display: grid;
        width: 146px;
        height: 146px;
        place-items: center;
        border: 3px solid rgba(197, 143, 255, 0.5);
        border-radius: 50%;
        background: radial-gradient(circle at 35% 28%, #c4b5fd, #5b43a9 35%, #11172b 72%);
        box-shadow:
          0 0 24px rgba(140, 77, 232, 0.22),
          inset 0 0 24px rgba(7, 10, 22, 0.5);
      }

      .author-avatar > span:first-child {
        color: rgba(255, 255, 255, 0.95);
        font-size: 42px;
        font-weight: 800;
        letter-spacing: -2px;
        text-shadow: 0 6px 22px rgba(0, 0, 0, 0.5);
      }

      .verified-badge {
        position: absolute;
        right: 2px;
        bottom: 6px;
        display: grid;
        width: 32px;
        height: 32px;
        place-items: center;
        border: 3px solid #0c1120;
        border-radius: 50%;
        background: linear-gradient(135deg, var(--primary), #7c3aed);
        color: #ffffff;
      }

      .verified-badge svg {
        width: 22px;
        height: 22px;
      }

      .author-information {
        min-width: 0;
      }

      .author-name-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }

      .author-name-row h1 {
        margin: 0;
        color: var(--text-strong);
        font-size: clamp(1.65rem, 2.8vw, 2.2rem);
        font-weight: 700;
        line-height: 1.2;
        letter-spacing: -0.02em;
      }

      .verified-inline {
        display: grid;
        width: 26px;
        height: 26px;
        place-items: center;
        color: var(--primary-soft);
      }

      .verified-inline svg {
        width: 26px;
        height: 26px;
      }

      .headline {
        margin: 6px 0 14px;
        color: var(--primary-soft);
        font-size: 0.95rem;
        font-weight: 600;
      }

      .author-meta {
        display: flex;
        flex-wrap: wrap;
        gap: 20px;
        color: var(--text-muted);
        font-size: 0.85rem;
      }

      .author-meta span {
        display: inline-flex;
        align-items: center;
        gap: 7px;
      }

      .author-meta svg {
        width: 17px;
        height: 17px;
      }

      .author-meta strong {
        color: var(--text-secondary);
        font-weight: 600;
      }

      .hero-actions {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 12px;
        margin-top: 18px;
      }

      .follow-button,
      .followers {
        display: inline-flex;
        min-height: 40px;
        align-items: center;
        justify-content: center;
        gap: 8px;
        padding: 0 18px;
        border-radius: 8px;
        font-size: 0.85rem;
        font-weight: 600;
      }

      .follow-button {
        border: 1px solid rgba(197, 143, 255, 0.28);
        background: linear-gradient(135deg, var(--primary), #7c3aed);
        box-shadow: 0 8px 24px rgba(126, 34, 206, 0.24);
        color: #fff;
        cursor: pointer;
      }

      .follow-button--active {
        background: rgba(126, 34, 206, 0.26);
        color: var(--primary-soft);
      }

      .followers {
        border: 1px solid var(--border);
        background: rgba(11, 16, 31, 0.68);
        color: var(--text-strong);
      }

      .follow-button svg,
      .followers svg,
      .author-meta svg,
      .verified-badge svg,
      .verified-inline svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .follow-button svg,
      .followers svg {
        width: 17px;
        height: 17px;
      }

      @media (max-width: 760px) {
        .author-hero {
          grid-template-columns: 1fr;
          justify-items: center;
          padding: 25px 20px;
          text-align: center;
        }

        .author-meta,
        .hero-actions,
        .author-name-row {
          justify-content: center;
        }

        .hero-landscape {
          opacity: 0.55;
        }
      }
    `,
  ],
})
export class AuthorHeroComponent {
  @Input({ required: true })
  profile!: AuthorProfile;

  @Input()
  following = false;

  @Input()
  followerLabel = '';

  @Output()
  readonly followToggle = new EventEmitter<void>();
}
