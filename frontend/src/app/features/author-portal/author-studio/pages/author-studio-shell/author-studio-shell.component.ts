import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { provideAuthorStudio } from '../../data-access/author-studio.providers';
import { AuthorStudioStore } from '../../data-access/author-studio.store';
import { StudioSidebarComponent } from '../../ui/studio-sidebar/studio-sidebar.component';
import { StudioTopbarComponent } from '../../ui/studio-topbar/studio-topbar.component';

@Component({
  selector: 'app-author-studio-shell',
  standalone: true,

  imports: [RouterOutlet, StudioSidebarComponent, StudioTopbarComponent],

  providers: [...provideAuthorStudio(), AuthorStudioStore],

  templateUrl: './author-studio-shell.component.html',

  styleUrl: './author-studio-shell.component.scss',

  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthorStudioShellComponent implements OnInit {
  protected readonly store = inject(AuthorStudioStore);

  protected readonly mobileOpen = signal(false);

  ngOnInit(): void {
    this.store.load();
  }

  protected toggleMobile(): void {
    this.mobileOpen.update((value) => !value);
  }

  protected closeMobile(): void {
    this.mobileOpen.set(false);
  }
}
