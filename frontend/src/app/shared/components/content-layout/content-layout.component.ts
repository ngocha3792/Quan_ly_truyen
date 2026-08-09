import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-content-layout',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './content-layout.component.html',
  styleUrl: './content-layout.component.scss',
})
export class ContentLayoutComponent {
  readonly asideWidth = input('340px');
}
