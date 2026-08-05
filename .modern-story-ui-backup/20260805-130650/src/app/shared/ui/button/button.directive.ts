import { Directive, HostBinding, Input } from '@angular/core';

export type ButtonVariant = 'default' | 'primary' | 'danger' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

@Directive({
  selector: 'button[appButton],a[appButton]',
  standalone: true,
  host: {
    class: 'ui-button',
  },
})
export class ButtonDirective {
  @Input() variant: ButtonVariant = 'default';
  @Input() size: ButtonSize = 'md';

  @HostBinding('class.ui-button--primary') get primary(): boolean {
    return this.variant === 'primary';
  }

  @HostBinding('class.ui-button--danger') get danger(): boolean {
    return this.variant === 'danger';
  }

  @HostBinding('class.ui-button--ghost') get ghost(): boolean {
    return this.variant === 'ghost';
  }

  @HostBinding('class.ui-button--sm') get small(): boolean {
    return this.size === 'sm';
  }

  @HostBinding('class.ui-button--lg') get large(): boolean {
    return this.size === 'lg';
  }
}
