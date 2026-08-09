import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { RouterLink } from '@angular/router';

export interface BreadcrumbItem {
  readonly label: string;
  readonly route?: string;
}

@Component({
  selector: 'app-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './breadcrumb.component.html',
  styleUrl: './breadcrumb.component.scss',
})
export class BreadcrumbComponent {
  readonly items = input.required<readonly BreadcrumbItem[]>();
}
