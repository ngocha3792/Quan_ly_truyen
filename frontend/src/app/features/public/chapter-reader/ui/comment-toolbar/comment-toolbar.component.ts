import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'app-comment-toolbar',
  standalone: true,
  templateUrl: './comment-toolbar.component.html',
  styleUrl: './comment-toolbar.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentToolbarComponent {
  readonly position = input.required<{ readonly x: number; readonly y: number }>();
  readonly comment = output<void>();
}
