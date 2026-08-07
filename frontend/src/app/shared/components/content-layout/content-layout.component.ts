import {
    ChangeDetectionStrategy,
    Component,
    input,
} from '@angular/core';

@Component({
    selector: 'app-content-layout',
    standalone: true,
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="layout">
      <section class="main-panel">
        <ng-content select="[main]" />
      </section>

      <aside class="aside-panel">
        <ng-content select="[aside]" />
      </aside>
    </div>
  `,
    styles: `
    :host {
      display: block;
      min-width: 0;
    }

    .layout {
      display: grid;
      grid-template-columns: minmax(0, 1fr) var(--aside-width, 340px);
      gap: var(--layout-gap, 1.25rem);
      align-items: start;
    }

    .main-panel {
      min-width: 0;
      padding: var(--main-padding, 1.25rem);
      display: grid;
      gap: var(--main-gap, 1.25rem);
      border: 1px solid var(--border);
      border-radius: 12px;
      background: linear-gradient(
        145deg,
        rgba(16, 22, 39, .9),
        rgba(10, 15, 28, .92)
      );
      box-shadow: 0 14px 35px rgba(0, 0, 0, .15);
    }

    .aside-panel {
      min-width: 0;
      display: grid;
      gap: var(--aside-gap, 1.25rem);
    }

    @media (max-width: 1100px) {
      .layout {
        grid-template-columns: 1fr;
      }

      .aside-panel {
        grid-template-columns:
          repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 720px) {
      .aside-panel {
        grid-template-columns: 1fr;
      }
    }
  `,
})
export class ContentLayoutComponent {
    readonly asideWidth = input('340px');
}
