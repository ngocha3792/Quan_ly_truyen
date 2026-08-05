import { ChangeDetectionStrategy, Component, ViewEncapsulation, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AppLogoComponent, ButtonDirective } from '../../../../shared/ui';
import { AuthIconComponent } from '../../components/auth-icon/auth-icon.component';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet, AppLogoComponent, AuthIconComponent, ButtonDirective],
  templateUrl: './auth-layout.component.html',
  styleUrls: ['../../styles/auth.pages.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {
  readonly darkMode = signal(true);

  toggleTheme(): void {
    this.darkMode.update((enabled) => !enabled);
  }
}
