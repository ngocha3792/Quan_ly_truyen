import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../../shared/components/icon/icon.component';

@Component({
    selector: 'app-profile-switch',
    standalone: true,
    imports: [IconComponent],
    changeDetection:
        ChangeDetectionStrategy.OnPush,
    template: `
    <label class="switch-card">
      <span class="switch-icon">
        <app-icon
          [name]="icon()"
          [size]="19"
        />
      </span>

      <span class="switch-copy">
        <strong>{{ title() }}</strong>
        <small>{{ description() }}</small>
      </span>

      <input
        type="checkbox"
        [checked]="checked()"
        (change)="onChange($event)"
      />

      <span
        class="switch-control"
        aria-hidden="true"
      >
        <span></span>
      </span>
    </label>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .switch-card {
      min-height: 66px;
      padding: 14px 16px;
      display: grid;
      grid-template-columns: auto 1fr auto;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--border);
      border-radius: 9px;
      cursor: pointer;
      background: rgba(10, 16, 30, .7);
      transition:
        border-color 160ms ease,
        background 160ms ease;
    }

    .switch-card:hover {
      border-color: rgba(158, 102, 240, .28);
      background: rgba(17, 24, 43, .86);
    }

    .switch-icon {
      color: #c084fc;
    }

    .switch-copy {
      min-width: 0;
      display: grid;
      gap: 4px;
    }

    strong {
      color: #f8fafc;
      font-size: 13.5px;
      font-weight: 650;
    }

    small {
      overflow: hidden;
      color: #94a3b8;
      font-size: 11.5px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    input {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }

    .switch-control {
      width: 36px;
      height: 20px;
      padding: 2px;
      display: flex;
      border-radius: 20px;
      background: #32394a;
      transition: background 160ms ease;
    }

    .switch-control span {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: #c4c8d3;
      transition: transform 160ms ease;
    }

    input:checked + .switch-control {
      background: linear-gradient(
        135deg,
        #7138d8,
        #a454ed
      );
    }

    input:checked + .switch-control span {
      transform: translateX(16px);
      background: #fff;
    }
  `,
})
export class ProfileSwitchComponent {
    readonly title = input.required<string>();
    readonly description = input.required<string>();
    readonly icon = input.required<IconName>();
    readonly checked = input(false);

    readonly checkedChange =
        output<boolean>();

    protected onChange(
        event: Event,
    ): void {
        const inputElement =
            event.target as HTMLInputElement;

        this.checkedChange.emit(
            inputElement.checked,
        );
    }
}