import {
    ChangeDetectionStrategy,
    Component,
    input,
    signal,
} from '@angular/core';

import { IconComponent } from '../../../../../shared/components/icon/icon.component';

@Component({
    selector: 'app-recovery-codes',

    standalone: true,

    imports: [IconComponent],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section class="codes-card">
      <div class="warning">
        <app-icon
          name="alert-triangle"
          [size]="20"
        />

        <p>
          Mỗi mã chỉ dùng được một lần.
          Đây là lần duy nhất hệ thống hiển thị
          toàn bộ mã này.
        </p>
      </div>

      <div class="codes-grid">
        @for (
          code of codes();
          track code
        ) {
          <code>{{ code }}</code>
        }
      </div>

      <div class="actions">
        <button
          type="button"
          (click)="copyAll()"
        >
          <app-icon
            name="copy"
            [size]="16"
          />

          {{
            copied()
              ? 'Đã sao chép'
              : 'Sao chép tất cả'
          }}
        </button>

        <button
          type="button"
          (click)="download()"
        >
          <app-icon
            name="save"
            [size]="16"
          />

          Lưu thành file
        </button>
      </div>
    </section>
  `,

    styles: `
    .codes-card {
      display: grid;
      gap: 17px;
    }

    .warning {
      padding: 13px;
      display: grid;
      grid-template-columns:
        auto minmax(0, 1fr);
      gap: 10px;
      border: 1px solid
        rgba(245, 158, 11, .22);
      border-radius: 8px;
      color: #f6bd55;
      background:
        rgba(180, 83, 9, .08);
    }

    .warning p {
      margin: 0;
      color: #aa8b5d;
      font-size: 10px;
      line-height: 1.6;
    }

    .codes-grid {
      display: grid;
      grid-template-columns:
        repeat(2, minmax(0, 1fr));
      gap: 9px;
    }

    code {
      padding: 11px 13px;
      border: 1px solid
        rgba(139, 151, 181, .2);
      border-radius: 7px;
      color: #e8e5ed;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      text-align: center;
      background:
        rgba(4, 9, 19, .55);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 9px;
    }

    button {
      min-height: 38px;
      padding: 0 14px;
      display: inline-flex;
      align-items: center;
      gap: 7px;
      border: 1px solid
        rgba(144, 87, 224, .55);
      border-radius: 7px;
      color: #bc80fa;
      font-size: 10px;
      font-weight: 750;
      cursor: pointer;
      background: transparent;
    }

    @media (max-width: 540px) {
      .codes-grid {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class RecoveryCodesComponent {
    readonly codes =
        input.required<
            readonly string[]
        >();

    protected readonly copied =
        signal(false);

    protected async copyAll():
        Promise<void> {
        await navigator.clipboard.writeText(
            this.codes().join('\n'),
        );

        this.copied.set(true);

        window.setTimeout(() => {
            this.copied.set(false);
        }, 1800);
    }

    protected download(): void {
        const content = [
            'TruyenHub - Mã khôi phục MFA',
            '',
            ...this.codes(),
            '',
            'Mỗi mã chỉ sử dụng được một lần.',
        ].join('\n');

        const blob = new Blob(
            [content],
            {
                type: 'text/plain;charset=utf-8',
            },
        );

        const url =
            URL.createObjectURL(blob);

        const anchor =
            document.createElement('a');

        anchor.href = url;
        anchor.download =
            'truyenhub-recovery-codes.txt';

        anchor.click();
        URL.revokeObjectURL(url);
    }
}