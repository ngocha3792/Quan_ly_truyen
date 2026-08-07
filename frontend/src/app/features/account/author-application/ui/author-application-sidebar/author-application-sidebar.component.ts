import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

import {
  AuthorBenefit,
  AuthorReviewRequirement,
  AuthorReviewStep,
} from '../../domain/author-application.models';

@Component({
  selector: 'app-author-application-sidebar',
  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <aside class="application-sidebar">
      <section class="author-banner">
        <span class="banner-icon">
          <svg viewBox="0 0 24 24">
            <path
              d="m12 3 2.5 5 5.5.8-4 3.9.9 5.5L12 15.6 7.1 18.2l.9-5.5-4-3.9L9.5 8 12 3Z"
            ></path>

            <circle cx="12" cy="12" r="9"></circle>
          </svg>
        </span>

        <div>
          <small>Tác giả mới</small>

          <strong>Mở cổng đăng ký</strong>

          <p>Chia sẻ câu chuyện của bạn đến hàng triệu độc giả.</p>
        </div>

        <span class="banner-sparkle" aria-hidden="true"> ✦ </span>
      </section>

      <section class="sidebar-card">
        <header>
          <svg viewBox="0 0 24 24">
            <path d="M12 3 4.5 6v5.4c0 4.6 3 7.9 7.5 9.6 4.5-1.7 7.5-5 7.5-9.6V6L12 3Z"></path>

            <path d="m9 12 2 2 4-4"></path>
          </svg>

          <h2>Điều kiện xét duyệt</h2>
        </header>

        <div class="requirements">
          @for (requirement of requirements; track requirement.id) {
            <article>
              <span>
                <svg viewBox="0 0 24 24">
                  <path d="m5 12 4 4L19 6"></path>
                </svg>
              </span>

              <p>
                {{ requirement.content }}
              </p>
            </article>
          }
        </div>
      </section>

      <section class="sidebar-card">
        <header>
          <svg viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="9"></circle>

            <path d="M12 7v5l3 2"></path>
          </svg>

          <h2>Quy trình</h2>
        </header>

        <div class="review-timeline">
          @for (step of reviewSteps; track step.number) {
            <article>
              <span class="step-number">
                {{ step.number }}
              </span>

              <div>
                <strong>
                  {{ step.number }}.
                  {{ step.title }}
                </strong>

                <p>
                  {{ step.description }}
                </p>
              </div>
            </article>
          }
        </div>
      </section>

      <section class="sidebar-card">
        <header>
          <svg viewBox="0 0 24 24">
            <path d="M8 21h8"></path>
            <path d="M12 17v4"></path>

            <path d="M7 4h10v3a5 5 0 0 1-10 0V4Z"></path>

            <path d="M7 6H4v1a4 4 0 0 0 4 4"></path>

            <path d="M17 6h3v1a4 4 0 0 1-4 4"></path>
          </svg>

          <h2>Quyền lợi tác giả</h2>
        </header>

        <div class="benefit-list">
          @for (benefit of benefits; track benefit.id) {
            <article>
              <span class="benefit-icon">
                @switch (benefit.icon) {
                  @case ('work') {
                    <svg viewBox="0 0 24 24">
                      <path
                        d="M4 5.5A2.5 2.5 0 0 1 6.5 3H18a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6.5A2.5 2.5 0 0 1 4 18.5v-13Z"
                      ></path>

                      <path d="M8 8h8"></path>
                      <path d="M8 12h8"></path>
                    </svg>
                  }

                  @case ('analytics') {
                    <svg viewBox="0 0 24 24">
                      <path d="M4 20V10"></path>
                      <path d="M10 20V4"></path>
                      <path d="M16 20v-7"></path>
                      <path d="M22 20V7"></path>
                    </svg>
                  }

                  @default {
                    <svg viewBox="0 0 24 24">
                      <circle cx="8" cy="8" r="3"></circle>

                      <circle cx="17" cy="9" r="2"></circle>

                      <path d="M2.5 20c.5-4 2.3-6 5.5-6s5 2 5.5 6"></path>

                      <path d="M14 14c3.7 0 5.8 2 6.3 5"></path>
                    </svg>
                  }
                }
              </span>

              <div>
                <strong>
                  {{ benefit.title }}
                </strong>

                <p>
                  {{ benefit.description }}
                </p>
              </div>
            </article>
          }
        </div>
      </section>
    </aside>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .application-sidebar {
        display: grid;
        gap: 1.25rem;
      }

      .author-banner,
      .sidebar-card {
        overflow: hidden;
        border: 1px solid var(--border);
        border-radius: 12px;
        background: linear-gradient(145deg, rgba(17, 25, 44, 0.98), rgba(10, 16, 31, 0.98));
        box-shadow: 0 18px 44px rgba(0, 0, 0, 0.11);
      }

      .author-banner {
        position: relative;
        display: grid;
        min-height: 90px;
        grid-template-columns:
          56px
          minmax(0, 1fr);
        align-items: center;
        gap: 14px;
        padding: 16px 20px;
        border-color: rgba(192, 132, 252, 0.38);
        background:
          radial-gradient(circle at 84% 20%, rgba(168, 85, 247, 0.23), transparent 33%),
          linear-gradient(135deg, rgba(70, 25, 119, 0.87), rgba(34, 20, 66, 0.92));
      }

      .banner-icon {
        display: grid;
        width: 52px;
        height: 52px;
        place-items: center;
        border: 1px solid rgba(216, 180, 254, 0.28);
        border-radius: 50%;
        background: rgba(126, 34, 206, 0.35);
        color: #e9d5ff;
        box-shadow: 0 0 18px rgba(168, 85, 247, 0.25);
      }

      .banner-icon svg {
        width: 28px;
        height: 28px;
      }

      .author-banner small,
      .author-banner strong,
      .author-banner p {
        display: block;
      }

      .author-banner small {
        color: #d8b4fe;
        font-size: 12px;
        font-weight: 700;
      }

      .author-banner strong {
        margin-top: 3px;
        color: #ffffff;
        font-size: 15px;
        font-weight: 700;
      }

      .author-banner p {
        margin: 4px 0 0;
        color: #c2bbd0;
        font-size: 12.5px;
      }

      .banner-sparkle {
        position: absolute;
        top: 14px;
        right: 16px;
        color: #c084fc;
        font-size: 18px;
        text-shadow: 0 0 10px #a855f7;
      }

      .sidebar-card header {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 1.2rem 1.35rem 0.8rem;
      }

      .sidebar-card header svg {
        width: 21px;
        height: 21px;
        color: #b779f6;
      }

      .sidebar-card header h2 {
        margin: 0;
        color: #e9e7ee;
        font-size: 1.1rem;
        font-weight: 700;
      }

      .requirements {
        padding: 0 1.35rem 1rem;
      }

      .requirements article {
        display: grid;
        grid-template-columns:
          24px
          minmax(0, 1fr);
        align-items: start;
        gap: 10px;
        margin-top: 10px;
      }

      .requirements article > span {
        display: grid;
        width: 22px;
        height: 22px;
        place-items: center;
        border-radius: 50%;
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        color: #ffffff;
      }

      .requirements article svg {
        width: 13px;
        height: 13px;
      }

      .requirements p {
        margin: 2px 0 0;
        color: var(--text-secondary);
        font-size: 13px;
        line-height: 1.45;
      }

      .review-timeline {
        position: relative;
        padding: 0 1.35rem 1rem;
      }

      .review-timeline::before {
        position: absolute;
        top: 17px;
        bottom: 30px;
        left: 2.15rem;
        width: 2px;
        content: '';
        background: linear-gradient(#a855f7, rgba(168, 85, 247, 0.2));
      }

      .review-timeline article {
        position: relative;
        display: grid;
        grid-template-columns:
          28px
          minmax(0, 1fr);
        align-items: start;
        gap: 12px;
        min-height: 60px;
      }

      .step-number {
        position: relative;
        z-index: 1;
        display: grid;
        width: 26px;
        height: 26px;
        place-items: center;
        border-radius: 50%;
        background: linear-gradient(135deg, #a855f7, #7c3aed);
        color: #ffffff;
        font-size: 12px;
        font-weight: 800;
        box-shadow: 0 0 10px rgba(168, 85, 247, 0.25);
      }

      .review-timeline strong {
        display: block;
        color: var(--text-strong);
        font-size: 14px;
        font-weight: 700;
      }

      .review-timeline p {
        margin: 4px 0 0;
        color: var(--text-muted);
        font-size: 12.5px;
        line-height: 1.45;
      }

      .benefit-list {
        padding: 0 1.35rem 1rem;
      }

      .benefit-list article {
        display: grid;
        min-height: 54px;
        grid-template-columns:
          40px
          minmax(0, 1fr);
        align-items: center;
        gap: 12px;
      }

      .benefit-icon {
        display: grid;
        width: 36px;
        height: 36px;
        place-items: center;
        border-radius: 50%;
        background: rgba(126, 34, 206, 0.17);
        color: #b967ff;
      }

      .benefit-icon svg {
        width: 19px;
        height: 19px;
      }

      .benefit-list strong {
        display: block;
        color: var(--text-strong);
        font-size: 14px;
        font-weight: 700;
      }

      .benefit-list p {
        margin: 3px 0 0;
        color: var(--text-muted);
        font-size: 12.5px;
        line-height: 1.4;
      }

      .application-sidebar svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      @media (max-width: 900px) {
        .application-sidebar {
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .author-banner {
          grid-column: 1 / -1;
        }
      }

      @media (max-width: 590px) {
        .application-sidebar {
          grid-template-columns: 1fr;
        }

        .author-banner {
          grid-column: auto;
        }
      }
    `,
  ],
})
export class AuthorApplicationSidebarComponent {
  @Input({ required: true })
  requirements: readonly AuthorReviewRequirement[] = [];

  @Input({ required: true })
  reviewSteps: readonly AuthorReviewStep[] = [];

  @Input({ required: true })
  benefits: readonly AuthorBenefit[] = [];
}
