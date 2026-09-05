import { ChangeDetectionStrategy, Component } from '@angular/core';

@Component({
  selector: 'app-legal-page-shell',

  standalone: true,

  changeDetection: ChangeDetectionStrategy.OnPush,

  templateUrl: './legal-page-shell.component.html',

  styleUrl: './legal-page-shell.component.scss',
})
export class LegalPageShellComponent {}
