import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-rank-movement',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  template: `
    <span class="movement" [attr.data-direction]="direction()" [attr.aria-label]="ariaLabel()">
      @if (delta() > 0) {
        ↑ {{ delta() }}
      } @else if (delta() < 0) {
        ↓ {{ absoluteDelta() }}
      } @else {
        —
      }
    </span>
  `,

  styles: `
    .movement {
      min-width: 24px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      color: #697388;
      font-size: 0.75rem;
      font-weight: 750;
    }

    .movement[data-direction='up'] {
      color: #48d875;
    }

    .movement[data-direction='down'] {
      color: #fb7185;
    }
  `,
})
export class RankMovementComponent {
  readonly delta = input(0);

  protected direction(): 'up' | 'down' | 'same' {
    if (this.delta() > 0) {
      return 'up';
    }

    if (this.delta() < 0) {
      return 'down';
    }

    return 'same';
  }

  protected absoluteDelta(): number {
    return Math.abs(this.delta());
  }

  protected ariaLabel(): string {
    if (this.delta() > 0) {
      return `Tăng ${this.delta()} bậc`;
    }

    if (this.delta() < 0) {
      return `Giảm ${this.absoluteDelta()} bậc`;
    }

    return 'Không thay đổi';
  }
}
