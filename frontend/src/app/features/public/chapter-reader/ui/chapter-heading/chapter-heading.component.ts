import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ChapterReaderView } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-heading',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './chapter-heading.component.html',

  styleUrl: './chapter-heading.component.scss',
})
export class ChapterHeadingComponent {
  @Input({ required: true })
  data!: ChapterReaderView;
}
