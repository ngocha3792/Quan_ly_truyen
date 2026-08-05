import { Directive, HostBinding, Input } from '@angular/core';

export type CardElevation = 'none' | 'sm' | 'md';

@Directive({
  selector: '[appCard]',
  standalone: true,
  host: {
    class: 'ui-card',
  },
})
export class CardDirective {
  @Input() elevation: CardElevation = 'sm';

  @HostBinding('class.ui-card--flat') get flat(): boolean {
    return this.elevation === 'none';
  }

  @HostBinding('class.ui-card--raised') get raised(): boolean {
    return this.elevation === 'md';
  }
}
