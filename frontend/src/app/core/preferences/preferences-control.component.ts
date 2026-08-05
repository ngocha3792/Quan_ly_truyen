import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AppPreferencesService } from './app-preferences.service';
import { ButtonDirective } from '../../shared/ui/button/button.directive';

@Component({
  selector: 'app-preferences-control',
  standalone: true,
  imports: [ButtonDirective],
  templateUrl: './preferences-control.component.html',
  styleUrls: ['./preferences-control.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PreferencesControlComponent {
  readonly preferences = inject(AppPreferencesService);
}
