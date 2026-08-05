import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { AppFooterComponent } from '../footer/app-footer.component';
import { AppHeaderComponent } from '../header/app-header.component';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [RouterOutlet, AppHeaderComponent, AppFooterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <app-header />
    <router-outlet />
    <app-footer />
  `,
})
export class AppShellComponent implements OnInit {
  private readonly auth = inject(AuthStore);

  ngOnInit(): void {
    this.auth.initialize();
  }
}
