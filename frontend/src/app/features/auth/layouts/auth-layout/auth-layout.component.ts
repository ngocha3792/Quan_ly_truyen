import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { AutoTranslateDirective } from '../../../../core/i18n';
import { PreferencesControlComponent } from '../../../../core/preferences/preferences-control.component';
import { AppLogoComponent } from '../../../../shared/ui';

@Component({
  selector: 'app-auth-layout',
  standalone: true,
  imports: [RouterLink, RouterOutlet, AutoTranslateDirective, AppLogoComponent, PreferencesControlComponent],
  templateUrl: './auth-layout.component.html',
  styleUrls: ['../../styles/auth.pages.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthLayoutComponent {}
