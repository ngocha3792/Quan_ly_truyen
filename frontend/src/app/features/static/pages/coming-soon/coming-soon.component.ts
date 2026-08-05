import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { IconComponent } from '../../../../shared/components/icon/icon.component';

@Component({
  selector: 'app-coming-soon',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <main class="page-container placeholder-page">
      <section>
        <span class="icon"><app-icon name="sparkles" [size]="30" /></span>
        <p class="eyebrow">TRUYENHUB MODULE</p>
        <h1>{{ title() }}</h1>
        <p>{{ description() }}</p>
        <a routerLink="/"><app-icon name="chevron-left" [size]="17" />Về trang chủ</a>
      </section>
    </main>
  `,
  styles: `
    .placeholder-page { min-height: 65vh; display: grid; place-items: center; padding-top: 3rem; padding-bottom: 3rem; }
    section { width: min(620px, 100%); padding: 3rem 2rem; border: 1px solid var(--border); border-radius: 20px; background: radial-gradient(circle at 50% 0, rgba(131, 68, 225, .16), transparent 42%), rgba(13,18,33,.86); text-align: center; }
    .icon { width: 62px; height: 62px; display: grid; place-items: center; margin: auto; border-radius: 18px; color: #d194ff; background: rgba(133, 74, 224, .14); }
    .eyebrow { margin: 1.1rem 0 .45rem; color: var(--primary-soft); font-size: .67rem; font-weight: 800; letter-spacing: .12em; }
    h1 { margin: 0; color: white; font-size: clamp(2rem, 5vw, 3.2rem); letter-spacing: -.05em; }
    h1 + p { max-width: 470px; margin: .8rem auto 1.4rem; color: var(--text-muted); font-size: .82rem; line-height: 1.7; }
    a { display: inline-flex; align-items: center; gap: .4rem; padding: .7rem 1rem; border-radius: 8px; color: white; background: linear-gradient(135deg, #9b4eeb, #6842db); text-decoration: none; font-size: .76rem; font-weight: 700; }
  `,
})
export class ComingSoonComponent {
  private readonly route = inject(ActivatedRoute);
  protected readonly title = signal('Đang phát triển');
  protected readonly description = signal('Module đã có route và layout sẵn, chỉ cần gắn API nghiệp vụ tương ứng.');

  constructor() {
    this.route.data.subscribe((data) => {
      this.title.set(typeof data['title'] === 'string' ? data['title'] : 'Đang phát triển');
      this.description.set(typeof data['description'] === 'string' ? data['description'] : 'Module đang được hoàn thiện.');
    });
  }
}
