import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

import {
    IconComponent,
    IconName,
} from '../../../../../../shared/components/icon/icon.component';

@Component({
    selector: 'app-security-panel',

    standalone: true,

    imports: [IconComponent],

    changeDetection:
        ChangeDetectionStrategy.OnPush,

    template: `
    <section
      class="panel"
      [attr.data-tone]="tone()"
    >
      <header class="panel-header">
        <div class="panel-icon">
          <app-icon
            [name]="icon()"
            [size]="22"
          />
        </div>

        <div>
          <h2>{{ title() }}</h2>

          @if (description()) {
            <p>{{ description() }}</p>
          }
        </div>
      </header>

      <div class="panel-content">
        <ng-content />
      </div>
    </section>
  `,

    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .panel {
      padding: 22px;
      border: 1px solid var(--border);
      border-radius: 14px;
      background:
        linear-gradient(
          145deg,
          rgba(16, 24, 42, .98),
          rgba(9, 15, 29, .98)
        );
      box-shadow:
        0 18px 46px rgba(0, 0, 0, .12);
    }

    .panel[data-tone='danger'] {
      border-color:
        rgba(244, 63, 94, .22);
    }

    .panel-header {
      display: flex;
      align-items: center;
      gap: 14px;
    }

    .panel-icon {
      width: 46px;
      height: 46px;
      flex: 0 0 auto;
      display: grid;
      place-items: center;
      border-radius: 11px;
      color: #c083ff;
      background:
        rgba(122, 61, 202, .2);
    }

    .panel[data-tone='danger']
    .panel-icon {
      color: #fb7185;
      background:
        rgba(190, 24, 93, .12);
    }

    h2 {
      margin: 0;
      color: #f0eef5;
      font-size: 15px;
    }

    p {
      margin: 7px 0 0;
      color: #7f899d;
      font-size: 10px;
      line-height: 1.55;
    }

    .panel-content {
      margin-top: 20px;
    }
  `,
})
export class SecurityPanelComponent {
    readonly title =
        input.required<string>();

    readonly description =
        input<string | null>(null);

    readonly icon =
        input.required<IconName>();

    readonly tone =
        input<'default' | 'danger'>(
            'default',
        );
}