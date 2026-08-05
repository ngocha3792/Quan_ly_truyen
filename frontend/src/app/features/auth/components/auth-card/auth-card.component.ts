import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-auth-card',
  standalone: true,
  template: '<ng-content />',
  host: { class: 'auth-card' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthCardComponent {}
