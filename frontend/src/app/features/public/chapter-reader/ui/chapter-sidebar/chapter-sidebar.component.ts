import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

import { ChapterReaderView } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-sidebar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <aside class="sidebar">
      <section class="sidebar-card">
        <h2>Đọc chương</h2>

        <button type="button" class="control-item" (click)="lightsToggle.emit()">
          <span class="control-icon">
            <svg viewBox="0 0 24 24">
              <path d="M9 18h6"></path>
              <path d="M10 22h4"></path>

              <path
                d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.5 15.3 14 16 14 18h-4c0-2-.5-2.7-1.5-3.5Z"
              ></path>
            </svg>
          </span>

          <span>
            {{ lightsOff ? 'Bật đèn' : 'Tắt đèn' }}
          </span>
        </button>

        <button type="button" class="control-item" (click)="fontDecrease.emit()">
          <span class="control-icon">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"></circle>

              <path d="M8 11h6"></path>
              <path d="m16 16 5 5"></path>
            </svg>
          </span>

          <span>Thu nhỏ</span>
        </button>

        <button type="button" class="control-item" (click)="fontIncrease.emit()">
          <span class="control-icon">
            <svg viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="7"></circle>

              <path d="M8 11h6"></path>
              <path d="M11 8v6"></path>
              <path d="m16 16 5 5"></path>
            </svg>
          </span>

          <span>Phóng to</span>
        </button>

        <button type="button" class="control-item" (click)="fontReset.emit()">
          <span class="control-icon">
            <svg viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="8"></circle>
            </svg>
          </span>

          <span>
            Mặc định
            <small>{{ fontSize }}px</small>
          </span>
        </button>
      </section>

      <section class="sidebar-card bookmark-card">
        <h2>Đánh dấu chương</h2>

        <button
          type="button"
          class="bookmark-button"
          [class.bookmark-button--active]="bookmarked"
          (click)="bookmarkToggle.emit()"
        >
          <svg viewBox="0 0 24 24">
            <path d="M6 4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18l-6-4-6 4V4Z"></path>
          </svg>

          <span>
            <strong>
              {{ bookmarked ? 'Đã đánh dấu chương' : 'Đánh dấu chương này' }}
            </strong>

            <small>
              {{ bookmarked ? 'Chương đã được lưu' : 'Lưu lại để đọc tiếp sau' }}
            </small>
          </span>
        </button>
      </section>

      <section class="sidebar-card chapter-info">
        <h2>Thông tin chương</h2>

        <p class="chapter-name">
          Chương {{ data.chapter.number }}:
          {{ data.chapter.title }}
        </p>

        <div class="info-row">
          <svg viewBox="0 0 24 24">
            <rect x="3" y="5" width="18" height="16" rx="2"></rect>

            <path d="M16 3v4"></path>
            <path d="M8 3v4"></path>
            <path d="M3 10h18"></path>
          </svg>

          <span>
            Đăng ngày:
            {{ data.chapter.publishedAt }}
          </span>
        </div>

        <div class="info-row">
          <svg viewBox="0 0 24 24">
            <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z"></path>

            <circle cx="12" cy="12" r="2.5"></circle>
          </svg>

          <span>
            Lượt xem:
            {{ data.chapter.views.toLocaleString('vi-VN') }}
          </span>
        </div>
      </section>
    </aside>
  `,

  styles: [
    `
      :host {
        display: block;
      }

      .sidebar {
        display: grid;
        gap: 16px;
      }

      .sidebar-card {
        overflow: hidden;
        border: 1px solid rgba(139, 151, 190, 0.17);
        border-radius: 13px;
        background: linear-gradient(145deg, rgba(15, 22, 41, 0.96), rgba(9, 15, 30, 0.96));
        box-shadow:
          0 18px 44px rgba(0, 0, 0, 0.12),
          inset 0 1px 0 rgba(255, 255, 255, 0.02);
      }

      .sidebar-card h2 {
        margin: 0;
        padding: 21px 23px 13px;
        color: #f7f5ff;
        font-size: 18px;
      }

      .control-item {
        display: flex;
        width: calc(100% - 28px);
        min-height: 58px;
        align-items: center;
        gap: 15px;
        margin: 0 14px;
        padding: 10px 8px;
        border: 0;
        border-bottom: 1px solid rgba(139, 151, 190, 0.13);
        background: transparent;
        color: #d7dbe7;
        font: inherit;
        font-size: 14px;
        text-align: left;
        cursor: pointer;
      }

      .control-item:last-child {
        border-bottom: 0;
        margin-bottom: 11px;
      }

      .control-item:hover {
        color: #d8b4fe;
      }

      .control-item small {
        margin-left: 6px;
        color: #7f89a5;
      }

      .control-icon {
        display: grid;
        width: 32px;
        height: 32px;
        flex: 0 0 auto;
        place-items: center;
        color: #b967ff;
      }

      .control-icon svg,
      .bookmark-button svg,
      .info-row svg {
        fill: none;
        stroke: currentColor;
        stroke-width: 1.8;
        stroke-linecap: round;
        stroke-linejoin: round;
      }

      .control-icon svg {
        width: 24px;
        height: 24px;
      }

      .bookmark-card {
        padding-bottom: 15px;
      }

      .bookmark-button {
        display: flex;
        width: calc(100% - 32px);
        align-items: center;
        gap: 14px;
        margin: 0 16px;
        padding: 12px 8px;
        border: 0;
        background: transparent;
        color: #b967ff;
        font: inherit;
        text-align: left;
        cursor: pointer;
      }

      .bookmark-button svg {
        width: 25px;
        height: 25px;
        flex: 0 0 auto;
      }

      .bookmark-button span {
        display: grid;
        gap: 5px;
      }

      .bookmark-button strong {
        color: #d2b1f8;
        font-size: 14px;
      }

      .bookmark-button small {
        color: #929bb2;
        font-size: 12px;
      }

      .bookmark-button--active {
        color: #e9d5ff;
      }

      .bookmark-button--active strong {
        color: #e9d5ff;
      }

      .chapter-info {
        padding-bottom: 20px;
      }

      .chapter-name {
        margin: 4px 23px 18px;
        color: #ece9f5;
        font-size: 14px;
        font-weight: 650;
        line-height: 1.5;
      }

      .info-row {
        display: flex;
        align-items: center;
        gap: 11px;
        margin: 13px 23px 0;
        color: #b0b7cb;
        font-size: 13px;
        line-height: 1.5;
      }

      .info-row svg {
        width: 19px;
        height: 19px;
        flex: 0 0 auto;
        color: #aaa4f4;
      }
    `,
  ],
})
export class ChapterSidebarComponent {
  @Input({ required: true })
  data!: ChapterReaderView;

  @Input()
  fontSize = 18;

  @Input()
  lightsOff = false;

  @Input()
  bookmarked = false;

  @Output()
  readonly fontDecrease = new EventEmitter<void>();

  @Output()
  readonly fontIncrease = new EventEmitter<void>();

  @Output()
  readonly fontReset = new EventEmitter<void>();

  @Output()
  readonly lightsToggle = new EventEmitter<void>();

  @Output()
  readonly bookmarkToggle = new EventEmitter<void>();
}
