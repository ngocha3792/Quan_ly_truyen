import { Directive } from '@angular/core';

@Directive({
  selector: '[appStatusBadge]',
  standalone: true,
  host: {
    class: 'ui-status-badge',
  },
})
export class StatusBadgeDirective {}
