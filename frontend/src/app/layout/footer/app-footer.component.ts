import {
  ChangeDetectionStrategy,
  Component,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { BrandLogoComponent } from '../../shared/components/brand-logo/brand-logo.component';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [
    RouterLink,
    BrandLogoComponent,
  ],
  changeDetection:
    ChangeDetectionStrategy.OnPush,
  template: `
    <footer>
      <div class="page-container footer-grid">
        <div class="brand-column">
          <app-brand-logo />

          <p>
            Nền tảng đọc và quản lý truyện
            hiện đại, tối ưu cho mọi thiết bị.
          </p>

          <div class="socials">
            <span>f</span>
            <span>◉</span>
            <span>▶</span>
            <span>◎</span>
          </div>
        </div>

        <div class="footer-column">
          <strong>Khám phá</strong>

          <a routerLink="/danh-sach">
            Danh sách truyện
          </a>

          <a routerLink="/the-loai">
            Thể loại
          </a>

          <a routerLink="/xep-hang">
            Xếp hạng
          </a>

          <a routerLink="/cap-nhat">
            Cập nhật mới
          </a>
        </div>

        <div class="footer-column">
          <strong>Tài khoản</strong>

          <a routerLink="/tai-khoan">
            Tổng quan
          </a>

          <a
            routerLink="/tai-khoan/thong-tin-ca-nhan"
          >
            Thông tin cá nhân
          </a>

          <a routerLink="/tai-khoan/bao-mat">
            Bảo mật
          </a>

          <a routerLink="/tai-khoan/thiet-bi">
            Thiết bị đăng nhập
          </a>
        </div>

        <div class="footer-column">
          <strong>Hỗ trợ</strong>

          <a routerLink="/gioi-thieu">
            Giới thiệu
          </a>

          <a routerLink="/dieu-khoan">
            Điều khoản sử dụng
          </a>

          <a routerLink="/quyen-rieng-tu">
            Quyền riêng tư
          </a>

          <a routerLink="/cong-dong">
            Liên hệ hỗ trợ
          </a>
        </div>
      </div>

      <div class="page-container copyright">
        © 2026 TruyenHub. Giao diện mẫu
        cho dự án Quản lý truyện.
      </div>
    </footer>
  `,
  styles: `
    footer {
      border-top:
        1px solid var(--border);
      background: #070b16;
    }

    .footer-grid {
      padding-top: 2.8rem;
      padding-bottom: 2.4rem;
      display: grid;
      grid-template-columns:
        2fr repeat(3, 1fr);
      gap: 3rem;
    }

    .brand-column p {
      max-width: 330px;
      margin: 1rem 0 0;
      color: var(--text-muted);
      font-size: .95rem;
      line-height: 1.65;
    }

    .socials {
      margin-top: 1.2rem;
      display: flex;
      gap: .55rem;
    }

    .socials span {
      width: 36px;
      height: 36px;
      display: grid;
      place-items: center;
      border-radius: 50%;
      color: #a7afc0;
      font-size: .95rem;
      background: #171d2d;
    }

    .footer-column {
      display: grid;
      align-content: start;
      gap: 1rem;
    }

    strong {
      margin-bottom: .25rem;
      color: var(--text-strong);
      font-size: 1.05rem;
    }

    a {
      color: var(--text-muted);
      font-size: .95rem;
      text-decoration: none;
    }

    a:hover {
      color: var(--primary-soft);
    }

    .copyright {
      padding-top: 1rem;
      padding-bottom: 1.2rem;
      border-top:
        1px solid var(--border);
      color: #5e6678;
      font-size: .85rem;
    }

    @media (max-width: 760px) {
      .footer-grid {
        grid-template-columns:
          1fr 1fr;
        gap: 2rem;
      }

      .brand-column {
        grid-column: 1 / -1;
      }
    }
  `,
})
export class AppFooterComponent { }