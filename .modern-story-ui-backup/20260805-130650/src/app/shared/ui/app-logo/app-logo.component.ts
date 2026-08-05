import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './app-logo.component.html',
  styleUrls: ['./app-logo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLogoComponent {
  @Input() caption = '';
  @Input() compact = false;
}
