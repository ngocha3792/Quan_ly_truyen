import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-author-biography',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './author-biography.component.html',

  styleUrl: './author-biography.component.scss',
})
export class AuthorBiographyComponent {
  @Input({ required: true })
  biography: readonly string[] = [];
}
