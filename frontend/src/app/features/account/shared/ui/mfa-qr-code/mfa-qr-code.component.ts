import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  input,
  signal,
  ViewChild,
} from '@angular/core';

import * as QRCode from 'qrcode';

@Component({
  selector: 'app-mfa-qr-code',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <div class="qr-wrapper">
      <canvas #canvas></canvas>

      @if (error()) {
        <p>{{ error() }}</p>
      }
    </div>
  `,

  styles: `
    .qr-wrapper {
      min-height: 210px;
      display: grid;
      place-items: center;
      border-radius: 13px;
      background: #fff;
    }

    canvas {
      width: 190px !important;
      height: 190px !important;
    }

    p {
      padding: 20px;
      color: #be123c;
      font-size: 11px;
      text-align: center;
    }
  `,
})
export class MfaQrCodeComponent implements AfterViewInit {
  readonly value = input.required<string>();

  protected readonly error = signal<string | null>(null);

  @ViewChild('canvas')
  private canvas?: ElementRef<HTMLCanvasElement>;

  constructor() {
    effect(() => {
      const value = this.value();

      queueMicrotask(() => {
        void this.render(value);
      });
    });
  }

  ngAfterViewInit(): void {
    void this.render(this.value());
  }

  private async render(value: string): Promise<void> {
    if (!this.canvas || !value) {
      return;
    }

    try {
      this.error.set(null);

      await QRCode.toCanvas(this.canvas.nativeElement, value, {
        width: 190,
        margin: 1,
        errorCorrectionLevel: 'M',
      });
    } catch {
      this.error.set('Không thể tạo mã QR. Hãy sử dụng khóa thiết lập thủ công.');
    }
  }
}
