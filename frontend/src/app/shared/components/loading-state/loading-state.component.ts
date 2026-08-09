import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-loading-state',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './loading-state.component.html',
  styleUrl: './loading-state.component.scss',
})
export class LoadingStateComponent {
  readonly message = input<string | null>(null);
}
