import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-rank-movement',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './rank-movement.component.html',

  styleUrl: './rank-movement.component.scss',
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
