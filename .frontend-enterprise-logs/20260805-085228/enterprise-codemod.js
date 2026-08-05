'use strict';

const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
const archiveRoot = path.resolve(process.argv[3] || path.join(root, '.frontend-enterprise-archive'));
const appRoot = path.join(root, 'src', 'app');

function fail(message) {
  throw new Error(message);
}

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8').replace(/^\uFEFF/, '');
}

function write(rel, content) {
  const file = path.join(root, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.replace(/\r?\n/g, '\n').trimEnd() + '\n', 'utf8');
}

function copyFile(fromRel, toRel) {
  const source = path.join(root, fromRel);
  const target = path.join(root, toRel);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

function moveAbsolute(source, destination) {
  if (!fs.existsSync(source)) return;
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  if (fs.existsSync(destination)) {
    fs.rmSync(destination, { recursive: true, force: true });
  }
  try {
    fs.renameSync(source, destination);
  } catch {
    fs.cpSync(source, destination, { recursive: true });
    fs.rmSync(source, { recursive: true, force: true });
  }
}

function archive(rel, bucket = 'source') {
  const source = path.join(root, rel);
  if (!fs.existsSync(source)) return;
  moveAbsolute(source, path.join(archiveRoot, bucket, rel));
}

function pascal(value) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function addDecoratorImport(source, names, importPath) {
  const wanted = [...new Set(names)].sort();
  if (!wanted.length) return source;
  const escaped = importPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*['\"]${escaped}['\"];?`);
  const match = source.match(re);
  if (match) {
    const current = match[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const merged = [...new Set([...current, ...wanted])].sort();
    return source.replace(match[0], `import { ${merged.join(', ')} } from '${importPath}';`);
  }
  const importLines = [...source.matchAll(/^import[^;]+;\s*$/gm)];
  const insertion = `import { ${wanted.join(', ')} } from '${importPath}';\n`;
  if (!importLines.length) return insertion + source;
  const last = importLines[importLines.length - 1];
  const index = last.index + last[0].length;
  return source.slice(0, index) + '\n' + insertion + source.slice(index);
}

function addStandaloneImports(source, names) {
  const wanted = [...new Set(names)].sort();
  if (!wanted.length) return source;
  const importsMatch = source.match(/imports\s*:\s*\[([\s\S]*?)\]/m);
  if (importsMatch) {
    const current = importsMatch[1]
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    const merged = [...new Set([...current, ...wanted])];
    return source.replace(importsMatch[0], `imports: [${merged.join(', ')}]`);
  }
  const standaloneMatch = source.match(/standalone\s*:\s*true\s*,?/);
  if (!standaloneMatch) fail('Không tìm thấy standalone: true khi thêm shared UI imports.');
  return source.replace(standaloneMatch[0], `${standaloneMatch[0]}\n  imports: [${wanted.join(', ')}],`);
}

function addAttributeToTags(html, tagExpression, predicate, attribute) {
  const re = new RegExp(`<(${tagExpression})(\\s[^>]*?)?>`, 'gi');
  return html.replace(re, (full, tag, attrs = '') => {
    if (new RegExp(`\\b${attribute}\\b`, 'i').test(attrs)) return full;
    if (!predicate(tag.toLowerCase(), attrs)) return full;
    return `<${tag}${attrs} ${attribute}>`;
  });
}

function enhanceTemplate(html) {
  let output = html;
  output = addAttributeToTags(
    output,
    'div|section|article',
    (_tag, attrs) => {
      const classMatch = attrs.match(/class\s*=\s*"([^"]+)"/i);
      if (!classMatch) return false;
      return classMatch[1]
        .split(/\s+/)
        .some((token) => /(?:^|[-_])(panel|card)$/.test(token) || /^(panel|card)$/.test(token));
    },
    'appCard',
  );
  output = addAttributeToTags(output, 'button', () => true, 'appButton');
  output = addAttributeToTags(
    output,
    'a',
    (_tag, attrs) => /class\s*=\s*"[^"]*(?:button|action|submit|save|upload)[^"]*"/i.test(attrs),
    'appButton',
  );
  output = addAttributeToTags(output, 'table', () => true, 'appDataTable');
  output = addAttributeToTags(
    output,
    'span',
    (_tag, attrs) => /class\s*=\s*"[^"]*(?:^|\s)status(?:\s|--|$)[^"]*"/i.test(attrs),
    'appStatusBadge',
  );
  return output;
}

function sharedUiImportsForTemplate(html) {
  const names = [];
  if (/\bappButton\b/.test(html)) names.push('ButtonDirective');
  if (/\bappCard\b/.test(html)) names.push('CardDirective');
  if (/\bappDataTable\b/.test(html)) names.push('DataTableDirective');
  if (/\bappStatusBadge\b/.test(html)) names.push('StatusBadgeDirective');
  return names;
}

function archiveScaffolding() {
  if (fs.existsSync(path.join(appRoot, 'layouts'))) {
    archive('src/app/layouts', 'scaffolding');
  }

  const todoUi = [
    'app-logo',
    'avatar',
    'badge',
    'button',
    'card',
    'confirm-dialog',
    'data-table',
    'empty-state',
    'error-state',
    'file-uploader',
    'form-field',
    'image',
    'loading-overlay',
    'pagination',
    'search-box',
    'skeleton',
    'status-badge',
    'toast',
    'toolbar',
  ];
  for (const name of todoUi) {
    const dir = path.join(appRoot, 'shared', 'ui', name);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir).filter((file) => file.endsWith('.ts') || file.endsWith('.html'));
    const isStub = files.some((file) => fs.readFileSync(path.join(dir, file), 'utf8').includes('TODO: implement'));
    if (isStub) archive(`src/app/shared/ui/${name}`, 'scaffolding');
  }
}

function createSharedUi() {
  write(
    'src/app/shared/ui/button/button.directive.ts',
    `import { Directive, HostBinding, Input } from '@angular/core';

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
}`,
  );

  write(
    'src/app/shared/ui/card/card.directive.ts',
    `import { Directive, HostBinding, Input } from '@angular/core';

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
}`,
  );

  write(
    'src/app/shared/ui/data-table/data-table.directive.ts',
    `import { Directive } from '@angular/core';

@Directive({
  selector: 'table[appDataTable]',
  standalone: true,
  host: {
    class: 'ui-data-table',
  },
})
export class DataTableDirective {}`,
  );

  write(
    'src/app/shared/ui/status-badge/status-badge.directive.ts',
    `import { Directive } from '@angular/core';

@Directive({
  selector: '[appStatusBadge]',
  standalone: true,
  host: {
    class: 'ui-status-badge',
  },
})
export class StatusBadgeDirective {}`,
  );

  write(
    'src/app/shared/ui/app-logo/app-logo.component.ts',
    `import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-logo',
  standalone: true,
  templateUrl: './app-logo.component.html',
  styleUrls: ['./app-logo.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppLogoComponent {
  @Input() caption = '';
  @Input() compact = false;
}`,
  );
  write(
    'src/app/shared/ui/app-logo/app-logo.component.html',
    `<span class="app-logo__mark" aria-hidden="true">Q</span>
<span class="app-logo__copy" [class.app-logo__copy--compact]="compact">
  <strong>QuanLyTruyen</strong>
  @if (caption) { <small>{{ caption }}</small> }
</span>`,
  );
  write(
    'src/app/shared/ui/app-logo/app-logo.component.scss',
    `:host{display:inline-flex;align-items:center;gap:.65rem;min-width:0}.app-logo__mark{display:grid;width:2.25rem;height:2.25rem;place-items:center;border-radius:.65rem;background:linear-gradient(135deg,#8b5cf6,#5b4bd8);color:#fff;font-weight:800;box-shadow:0 .5rem 1.4rem rgba(91,75,216,.25)}.app-logo__copy{display:flex;min-width:0;flex-direction:column;line-height:1.05}.app-logo__copy strong{font-size:.95rem;letter-spacing:-.02em}.app-logo__copy small{margin-top:.28rem;color:var(--ui-muted,#8f9bad);font-size:.68rem}.app-logo__copy--compact small{display:none}`,
  );

  write(
    'src/app/shared/ui/avatar/avatar.component.ts',
    `import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-avatar',
  standalone: true,
  templateUrl: './avatar.component.html',
  styleUrls: ['./avatar.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarComponent {
  @Input() src = '';
  @Input() alt = '';
  @Input() name = '';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';

  get initials(): string {
    return this.name
      .split(/\\s+/)
      .filter(Boolean)
      .slice(-2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('');
  }
}`,
  );
  write(
    'src/app/shared/ui/avatar/avatar.component.html',
    `@if (src) {
  <img [class]="'avatar avatar--' + size" [src]="src" [alt]="alt || name" />
} @else {
  <span [class]="'avatar avatar--' + size" aria-hidden="true">{{ initials || '?' }}</span>
}`,
  );
  write(
    'src/app/shared/ui/avatar/avatar.component.scss',
    `:host{display:inline-flex}.avatar{display:grid;flex:0 0 auto;place-items:center;border-radius:50%;object-fit:cover;background:#2a3648;color:#fff;font-weight:700}.avatar--sm{width:1.75rem;height:1.75rem;font-size:.65rem}.avatar--md{width:2.25rem;height:2.25rem;font-size:.75rem}.avatar--lg{width:3rem;height:3rem;font-size:.9rem}`,
  );

  write(
    'src/app/shared/ui/search-box/search-box.component.ts',
    `import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'app-search-box',
  standalone: true,
  templateUrl: './search-box.component.html',
  styleUrls: ['./search-box.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchBoxComponent {
  @Input() placeholder = 'Tìm kiếm...';
  @Input() ariaLabel = 'Tìm kiếm';
  @Output() readonly queryChange = new EventEmitter<string>();

  onInput(event: Event): void {
    this.queryChange.emit((event.target as HTMLInputElement).value);
  }
}`,
  );
  write(
    'src/app/shared/ui/search-box/search-box.component.html',
    `<label class="search-box">
  <span aria-hidden="true">⌕</span>
  <input type="search" [attr.aria-label]="ariaLabel" [placeholder]="placeholder" (input)="onInput($event)" />
</label>`,
  );
  write(
    'src/app/shared/ui/search-box/search-box.component.scss',
    `:host{display:block;min-width:0}.search-box{display:flex;height:2.4rem;align-items:center;gap:.55rem;padding:0 .75rem;border:1px solid var(--ui-border,#2c394b);border-radius:.65rem;background:var(--ui-surface,#111b29);color:var(--ui-muted,#8f9bad)}.search-box input{min-width:0;flex:1;border:0;outline:0;background:transparent;color:inherit;font:inherit}.search-box input::placeholder{color:inherit}`,
  );

  write(
    'src/app/shared/ui/page-header/page-header.component.ts',
    `import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-page-header',
  standalone: true,
  templateUrl: './page-header.component.html',
  styleUrls: ['./page-header.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageHeaderComponent {
  @Input({ required: true }) title = '';
  @Input() description = '';
}`,
  );
  write(
    'src/app/shared/ui/page-header/page-header.component.html',
    `<header class="page-header">
  <div class="page-header__copy">
    <h1>{{ title }}</h1>
    @if (description) { <p>{{ description }}</p> }
  </div>
  <div class="page-header__actions"><ng-content select="[pageHeaderActions]" /></div>
</header>`,
  );
  write(
    'src/app/shared/ui/page-header/page-header.component.scss',
    `:host{display:block}.page-header{display:flex;min-width:0;align-items:center;justify-content:space-between;gap:1rem}.page-header__copy{min-width:0}.page-header h1{margin:0;font-size:clamp(1.1rem,2vw,1.45rem);letter-spacing:-.025em}.page-header p{margin:.35rem 0 0;color:var(--ui-muted,#8f9bad);font-size:.8rem}.page-header__actions{display:flex;align-items:center;gap:.65rem}`,
  );

  write(
    'src/app/shared/ui/empty-state/empty-state.component.ts',
    `import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  standalone: true,
  templateUrl: './empty-state.component.html',
  styleUrls: ['./empty-state.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EmptyStateComponent {
  @Input() title = 'Chưa có dữ liệu';
  @Input() description = '';
}`,
  );
  write(
    'src/app/shared/ui/empty-state/empty-state.component.html',
    `<section class="empty-state" role="status"><span aria-hidden="true">◇</span><h2>{{ title }}</h2>@if (description) { <p>{{ description }}</p> }<ng-content /></section>`,
  );
  write(
    'src/app/shared/ui/empty-state/empty-state.component.scss',
    `:host{display:block}.empty-state{display:grid;min-height:12rem;place-items:center;align-content:center;gap:.55rem;padding:2rem;text-align:center}.empty-state>span{font-size:2rem;color:#8b5cf6}.empty-state h2,.empty-state p{margin:0}.empty-state p{max-width:34rem;color:var(--ui-muted,#8f9bad)}`,
  );

  write(
    'src/app/shared/ui/loading-overlay/loading-overlay.component.ts',
    `import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

@Component({
  selector: 'app-loading-overlay',
  standalone: true,
  templateUrl: './loading-overlay.component.html',
  styleUrls: ['./loading-overlay.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoadingOverlayComponent {
  @Input() visible = false;
  @Input() label = 'Đang tải';
}`,
  );
  write(
    'src/app/shared/ui/loading-overlay/loading-overlay.component.html',
    `@if (visible) { <div class="loading-overlay" role="status"><span class="loading-overlay__spinner"></span><span>{{ label }}</span></div> }`,
  );
  write(
    'src/app/shared/ui/loading-overlay/loading-overlay.component.scss',
    `:host{display:contents}.loading-overlay{position:absolute;z-index:20;inset:0;display:grid;place-items:center;align-content:center;gap:.75rem;background:rgba(8,17,29,.72);backdrop-filter:blur(3px)}.loading-overlay__spinner{width:2rem;height:2rem;border:.2rem solid rgba(255,255,255,.2);border-top-color:#8b5cf6;border-radius:50%;animation:spin .75s linear infinite}@keyframes spin{to{transform:rotate(1turn)}}`,
  );

  write(
    'src/app/shared/ui/index.ts',
    `export * from './app-logo/app-logo.component';
export * from './avatar/avatar.component';
export * from './button/button.directive';
export * from './card/card.directive';
export * from './data-table/data-table.directive';
export * from './empty-state/empty-state.component';
export * from './loading-overlay/loading-overlay.component';
export * from './page-header/page-header.component';
export * from './search-box/search-box.component';
export * from './status-badge/status-badge.directive';`,
  );

  write(
    'src/styles/components/_ui-kit.scss',
    `.ui-button{font:inherit;cursor:pointer}.ui-button:disabled{cursor:not-allowed;opacity:.55}.ui-button--primary{border-color:transparent!important;background:#7752e8!important;color:#fff!important}.ui-button--danger{border-color:rgba(239,68,68,.4)!important;color:#fecaca!important}.ui-button--ghost{border-color:transparent!important;background:transparent!important}.ui-button--sm{min-height:1.9rem}.ui-button--lg{min-height:2.8rem}.ui-card{min-width:0;isolation:isolate}.ui-card--raised{box-shadow:0 1rem 2.5rem rgba(0,0,0,.16)}.ui-card--flat{box-shadow:none!important}.ui-data-table{width:100%;border-collapse:collapse}.ui-status-badge{display:inline-flex;align-items:center;justify-content:center;white-space:nowrap}`,
  );

  const styleIndex = 'src/styles/_index.scss';
  if (exists(styleIndex)) {
    let indexSource = read(styleIndex);
    if (!indexSource.includes("components/ui-kit")) {
      indexSource += "\n@use 'components/ui-kit' as ui-kit;\n";
      write(styleIndex, indexSource);
    }
  }
}

function createLayouts() {
  write(
    'src/app/layouts/workspace-layout/workspace-layout.component.ts',
    `import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, ViewEncapsulation, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppLogoComponent, AvatarComponent, ButtonDirective, PageHeaderComponent, SearchBoxComponent } from '../../shared/ui';

export interface WorkspaceNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly icon: string;
  readonly exact?: boolean;
}

interface WorkspaceRouteMeta {
  readonly title: string;
  readonly description: string;
}

@Component({
  selector: 'app-workspace-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AppLogoComponent, AvatarComponent, ButtonDirective, PageHeaderComponent, SearchBoxComponent],
  templateUrl: './workspace-layout.component.html',
  styleUrls: ['./workspace-layout.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WorkspaceLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @Input() variant: 'admin' | 'author' | 'account' = 'admin';
  @Input() brandCaption = '';
  @Input() defaultTitle = '';
  @Input() navigation: readonly WorkspaceNavigationItem[] = [];
  @Input() avatarSrc = '';
  @Input() userName = '';
  @Input() userRole = '';
  @Input() notificationCount = 0;
  @Input() searchPlaceholder = 'Tìm kiếm...';
  @Input() primaryActionLabel = '';
  @Input() primaryActionRoute = '';

  readonly sidebarOpen = signal(false);
  readonly routeMeta = signal<WorkspaceRouteMeta>({ title: '', description: '' });

  ngOnInit(): void {
    this.refreshRouteMeta();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.sidebarOpen.set(false);
        this.refreshRouteMeta();
      });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update((open) => !open);
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  private refreshRouteMeta(): void {
    let activeRoute = this.route;
    while (activeRoute.firstChild) activeRoute = activeRoute.firstChild;
    const data = activeRoute.snapshot.data as Record<string, unknown>;
    this.routeMeta.set({
      title: typeof data['pageTitle'] === 'string' ? data['pageTitle'] : this.defaultTitle,
      description: typeof data['pageDescription'] === 'string' ? data['pageDescription'] : '',
    });
  }
}`,
  );

  write(
    'src/app/layouts/workspace-layout/workspace-layout.component.html',
    `<div
  class="workspace-layout"
  [class.admin-center]="variant === 'admin'"
  [class.suite]="variant === 'author'"
  [class.account-center]="variant === 'account'"
  [attr.data-workspace]="variant"
>
  <button appButton class="workspace-overlay" type="button" aria-label="Đóng menu" [class.visible]="sidebarOpen()" (click)="closeSidebar()"></button>

  <aside class="workspace-sidebar" [class.open]="sidebarOpen()">
    <a class="workspace-brand" [routerLink]="navigation[0]?.route || '/'" (click)="closeSidebar()">
      <app-logo [caption]="brandCaption" />
    </a>

    <nav class="workspace-navigation" aria-label="Điều hướng chức năng">
      @for (item of navigation; track item.route) {
        <a
          [routerLink]="item.route"
          routerLinkActive="active"
          [routerLinkActiveOptions]="{ exact: item.exact ?? false }"
          (click)="closeSidebar()"
        >
          <span class="workspace-navigation__icon" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
        </a>
      }
    </nav>

    @if (primaryActionLabel && primaryActionRoute) {
      <a appButton variant="primary" class="workspace-primary-action" [routerLink]="primaryActionRoute" (click)="closeSidebar()">{{ primaryActionLabel }}</a>
    }

    <div class="workspace-user-card">
      <app-avatar [src]="avatarSrc" [name]="userName" />
      <span><strong>{{ userName }}</strong><small>{{ userRole }}</small></span>
    </div>
  </aside>

  <main class="workspace-main">
    <header class="workspace-topbar">
      <button appButton class="workspace-menu" type="button" aria-label="Mở menu" (click)="toggleSidebar()">☰</button>
      <app-page-header [title]="routeMeta().title" [description]="routeMeta().description" />
      <div class="workspace-topbar__actions">
        <app-search-box [placeholder]="searchPlaceholder" />
        <button appButton class="workspace-notification" type="button" aria-label="Thông báo">♢@if (notificationCount > 0) { <span>{{ notificationCount }}</span> }</button>
        <button appButton class="workspace-account" type="button"><app-avatar size="sm" [src]="avatarSrc" [name]="userName" /><span>{{ userName }}</span></button>
      </div>
    </header>

    <section class="workspace-content"><router-outlet /></section>
  </main>
</div>`,
  );

  write(
    'src/app/layouts/workspace-layout/workspace-layout.component.scss',
    `.workspace-layout{--workspace-sidebar:15rem;--ui-bg:#08111d;--ui-surface:#111b29;--ui-border:#29374b;--ui-text:#edf2f8;--ui-muted:#8f9bad;display:block;min-height:100vh;background:var(--ui-bg);color:var(--ui-text);font-family:Inter,ui-sans-serif,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}.workspace-layout *,.workspace-layout *::before,.workspace-layout *::after{box-sizing:border-box}.workspace-layout a{color:inherit;text-decoration:none}.workspace-sidebar{position:fixed;z-index:60;inset:0 auto 0 0;display:flex;width:var(--workspace-sidebar);flex-direction:column;border-right:1px solid var(--ui-border);background:linear-gradient(180deg,#09111d,#070d16);box-shadow:.5rem 0 2rem rgba(0,0,0,.15);transition:transform .2s ease}.workspace-brand{display:flex;min-height:4.6rem;align-items:center;padding:0 1rem;border-bottom:1px solid var(--ui-border)}.workspace-navigation{display:flex;min-height:0;flex:1;flex-direction:column;gap:.25rem;padding:.8rem;overflow:auto}.workspace-navigation a{display:flex;min-height:2.65rem;align-items:center;gap:.7rem;padding:0 .75rem;border-radius:.65rem;color:#bcc6d4;font-size:.8rem;transition:.15s ease}.workspace-navigation a:hover{background:rgba(255,255,255,.05);color:#fff}.workspace-navigation a.active{background:linear-gradient(110deg,rgba(119,82,232,.9),rgba(87,67,158,.84));color:#fff}.workspace-navigation__icon{display:grid;width:1.4rem;place-items:center;color:#bca8ff;font-size:.95rem}.workspace-primary-action{display:flex;margin:.5rem .8rem;min-height:2.55rem;align-items:center;justify-content:center;border-radius:.65rem}.workspace-user-card{display:flex;align-items:center;gap:.65rem;margin:.55rem .8rem .8rem;padding:.65rem;border:1px solid var(--ui-border);border-radius:.75rem;background:var(--ui-surface)}.workspace-user-card>span{display:flex;min-width:0;flex-direction:column}.workspace-user-card strong{font-size:.78rem}.workspace-user-card small{margin-top:.2rem;color:var(--ui-muted);font-size:.68rem}.workspace-main{min-width:0;min-height:100vh;margin-left:var(--workspace-sidebar)}.workspace-topbar{position:sticky;z-index:40;top:0;display:grid;min-height:4.6rem;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:1rem;padding:.7rem 1.1rem;border-bottom:1px solid var(--ui-border);background:rgba(8,17,29,.94);backdrop-filter:blur(16px)}.workspace-menu{display:none;width:2.4rem;height:2.4rem;place-items:center;border:1px solid var(--ui-border);border-radius:.6rem;background:var(--ui-surface);color:inherit}.workspace-topbar__actions{display:flex;align-items:center;gap:.55rem}.workspace-topbar__actions app-search-box{width:min(19rem,25vw)}.workspace-notification{position:relative;display:grid;width:2.4rem;height:2.4rem;place-items:center;border:1px solid var(--ui-border);border-radius:50%;background:var(--ui-surface);color:inherit}.workspace-notification span{position:absolute;top:-.25rem;right:-.25rem;display:grid;min-width:1rem;height:1rem;padding:0 .2rem;place-items:center;border-radius:999px;background:#ef476f;color:#fff;font-size:.6rem}.workspace-account{display:flex;min-height:2.4rem;align-items:center;gap:.45rem;padding:.2rem .55rem .2rem .25rem;border:1px solid var(--ui-border);border-radius:999px;background:var(--ui-surface);color:inherit}.workspace-account span{font-size:.72rem}.workspace-content{width:min(100%,105rem);margin:0 auto;padding:1rem 1.1rem 2rem}.workspace-overlay{position:fixed;z-index:55;inset:0;display:none;border:0;background:rgba(2,7,13,.68)}@media(max-width:900px){.workspace-sidebar{transform:translateX(-105%)}.workspace-sidebar.open{transform:translateX(0)}.workspace-main{margin-left:0}.workspace-menu{display:grid}.workspace-overlay.visible{display:block}.workspace-topbar__actions app-search-box{display:none}.workspace-account span{display:none}}@media(max-width:560px){.workspace-topbar{grid-template-columns:auto minmax(0,1fr) auto;padding:.65rem}.workspace-notification{display:none}.workspace-content{padding:.75rem}.workspace-topbar app-page-header p{display:none}}`,
  );

  write(
    'src/app/layouts/public-layout/public-layout.component.ts',
    `import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AppLogoComponent, ButtonDirective, SearchBoxComponent } from '../../shared/ui';

export interface PublicNavigationItem {
  readonly label: string;
  readonly route: string;
  readonly exact?: boolean;
}

interface PublicRouteMeta {
  readonly hideChrome: boolean;
  readonly pageClass: string;
}

@Component({
  selector: 'app-public-layout',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, RouterOutlet, AppLogoComponent, ButtonDirective, SearchBoxComponent],
  templateUrl: './public-layout.component.html',
  styleUrls: ['./public-layout.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PublicLayoutComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  @Input() navigation: readonly PublicNavigationItem[] = [];
  @Input() searchRoute = '/search';

  readonly mobileNavOpen = signal(false);
  readonly routeMeta = signal<PublicRouteMeta>({ hideChrome: false, pageClass: '' });

  toggleMobileNav(): void {
    this.mobileNavOpen.update((open) => !open);
  }

  ngOnInit(): void {
    this.refreshRouteMeta();
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.mobileNavOpen.set(false);
        this.refreshRouteMeta();
      });
  }

  private refreshRouteMeta(): void {
    let activeRoute = this.route;
    while (activeRoute.firstChild) activeRoute = activeRoute.firstChild;
    const data = activeRoute.snapshot.data as Record<string, unknown>;
    this.routeMeta.set({
      hideChrome: data['hideChrome'] === true,
      pageClass: typeof data['pageClass'] === 'string' ? data['pageClass'] : '',
    });
  }
}`,
  );

  write(
    'src/app/layouts/public-layout/public-layout.component.html',
    `<div class="public-layout public-site" [class.reader-page]="routeMeta().pageClass === 'reader-page'" [class.not-found-page]="routeMeta().pageClass === 'not-found-page'">
  @if (!routeMeta().hideChrome) {
    <header class="site-header public-layout__header">
      <div class="header-inner public-layout__header-inner">
        <a class="site-brand" routerLink="/"><app-logo [compact]="true" /></a>
        <nav class="desktop-nav public-layout__nav" aria-label="Điều hướng chính">
          @for (item of navigation; track item.route) {
            <a [routerLink]="item.route" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: item.exact ?? false }">{{ item.label }}</a>
          }
        </nav>
        <a class="header-search public-layout__search" [routerLink]="searchRoute"><app-search-box placeholder="Tìm kiếm truyện, tác giả..." /></a>
        <div class="header-actions public-layout__actions">
          <button appButton type="button" aria-label="Chế độ tối">◐</button>
          <a class="login-link" routerLink="/auth/login">Đăng nhập</a>
          <button appButton class="mobile-menu-button" type="button" aria-label="Mở menu" (click)="toggleMobileNav()">☰</button>
        </div>
      </div>
      @if (mobileNavOpen()) {
        <nav class="mobile-nav public-layout__mobile-nav">
          @for (item of navigation; track item.route) { <a [routerLink]="item.route" (click)="mobileNavOpen.set(false)">{{ item.label }}</a> }
        </nav>
      }
    </header>
  }
  <main><router-outlet /></main>
  @if (!routeMeta().hideChrome && routeMeta().pageClass !== 'reader-page') {
    <footer class="public-layout__footer"><span>© QuanLyTruyen</span><nav><a routerLink="/about">Giới thiệu</a><a routerLink="/guide">Hướng dẫn</a></nav></footer>
  }
</div>`,
  );

  write(
    'src/app/layouts/public-layout/public-layout.component.scss',
    `:host{display:block}.public-layout{min-height:100vh}.public-layout__header{position:sticky;z-index:45;top:0}.public-layout__header-inner{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(14rem,22rem) auto;align-items:center;gap:1rem}.public-layout__nav{display:flex;align-items:center;gap:1rem}.public-layout__search{display:block}.public-layout__search app-search-box{pointer-events:none}.public-layout__actions{display:flex;align-items:center;gap:.6rem}.public-layout__actions button{display:grid;width:2.35rem;height:2.35rem;place-items:center;border:1px solid var(--border,#29374b);border-radius:50%;background:transparent;color:inherit}.public-layout__mobile-nav{position:absolute;right:1rem;left:1rem;top:100%;display:flex;flex-direction:column;padding:.6rem;border:1px solid var(--border,#29374b);border-radius:.75rem;background:#0d1724}.public-layout__mobile-nav a{padding:.7rem}.public-layout__footer{display:flex;min-height:4rem;align-items:center;justify-content:space-between;gap:1rem;padding:1rem clamp(1rem,5vw,4rem);border-top:1px solid var(--border,#29374b);color:#8f9bad;font-size:.75rem}.public-layout__footer nav{display:flex;gap:1rem}.mobile-menu-button{display:none!important}@media(max-width:980px){.public-layout__header-inner{grid-template-columns:auto minmax(0,1fr) auto}.public-layout__nav,.public-layout__search{display:none}.mobile-menu-button{display:grid!important}}`,
  );

  write(
    'src/app/layouts/index.ts',
    `export * from './public-layout/public-layout.component';
export * from './workspace-layout/workspace-layout.component';`,
  );
}

const featureDefinitions = [
  {
    id: 'admin-center',
    oldPrefix: 'AdminCenter',
    newPrefix: 'Admin',
    oldPageDir: 'admin-center-page',
    rootClass: 'admin-center',
    facade: 'AdminCenterFacade',
    adapter: 'AdminCenterViewModel',
    layoutClass: 'AdminCenterLayoutComponent',
    layoutSelector: 'app-admin-center-layout',
    styleFile: 'admin-center.pages.scss',
    layoutTemplate: `<app-workspace-layout variant="admin" brandCaption="Admin" defaultTitle="Tổng quan" [navigation]="navigation" avatarSrc="/assets/admin-center/admin-avatar.svg" userName="Admin" userRole="Quản trị viên" [notificationCount]="5" searchPlaceholder="Tìm kiếm nhanh..." />`,
    layoutInputs: `readonly navigation = ADMIN_NAVIGATION;`,
    configName: 'ADMIN_NAVIGATION',
    configFile: 'admin-navigation.config.ts',
    config: [
      ['Dashboard', '/dashboard', '▦', true], ['Quản lý truyện', '/admin/stories', '▤'], ['Quản lý chương', '/admin/stories/1/chapters', '☷'], ['Người dùng', '/admin/users', '♙'], ['Tác giả', '/admin/authors', '✎'], ['Bình luận', '/admin/comments', '◌'], ['Báo cáo', '/admin/reports', '⚑'], ['Danh mục', '/admin/categories', '▦'], ['Giao dịch', '/admin/transactions', '₫'], ['Quảng cáo', '/admin/ads', '◈'], ['Cấu hình', '/admin/settings', '⚙'], ['Nhật ký', '/admin/activity-logs', '⌁'],
    ],
    pages: [
      ['overview', 'Dashboard | QuanLyTruyen Admin', 'Tổng quan', 'Chào mừng trở lại, đây là tình hình hệ thống hôm nay.'],
      ['stories', 'Quản lý truyện | QuanLyTruyen Admin', 'Quản lý truyện', 'Kiểm duyệt và vận hành kho truyện.'],
      ['chapters', 'Quản lý chương | QuanLyTruyen Admin', 'Quản lý chương', 'Theo dõi trạng thái xuất bản từng chương.'],
      ['users', 'Quản lý người dùng | QuanLyTruyen Admin', 'Quản lý người dùng', 'Tài khoản, vai trò và trạng thái hoạt động.'],
      ['authors', 'Quản lý tác giả | QuanLyTruyen Admin', 'Quản lý tác giả', 'Hồ sơ và hiệu suất cộng tác viên.'],
      ['comments', 'Quản lý bình luận | QuanLyTruyen Admin', 'Quản lý bình luận', 'Kiểm duyệt thảo luận cộng đồng.'],
      ['reports', 'Quản lý báo cáo | QuanLyTruyen Admin', 'Quản lý báo cáo', 'Xử lý các nội dung được người dùng báo cáo.'],
      ['categories', 'Quản lý danh mục | QuanLyTruyen Admin', 'Quản lý danh mục', 'Chuẩn hóa taxonomy và thể loại.'],
      ['transactions', 'Quản lý giao dịch | QuanLyTruyen Admin', 'Quản lý giao dịch', 'Đối soát dòng tiền trên nền tảng.'],
      ['ads', 'Quản lý quảng cáo | QuanLyTruyen Admin', 'Quản lý quảng cáo', 'Lịch chạy và vị trí hiển thị quảng cáo.'],
      ['settings', 'Cấu hình hệ thống | QuanLyTruyen Admin', 'Cấu hình hệ thống', 'Thiết lập vận hành toàn hệ thống.'],
      ['activity', 'Nhật ký hoạt động | QuanLyTruyen Admin', 'Nhật ký hoạt động', 'Theo dõi các thay đổi quan trọng.'],
    ],
  },
  {
    id: 'author-suite', oldPrefix: 'AuthorSuite', newPrefix: 'Author', oldPageDir: 'author-suite-page', rootClass: 'suite', facade: 'AuthorSuiteFacade', adapter: 'AuthorSuiteViewModel', layoutClass: 'AuthorSuiteLayoutComponent', layoutSelector: 'app-author-suite-layout', styleFile: 'author-suite.pages.scss',
    layoutTemplate: `<app-workspace-layout variant="author" brandCaption="Tác giả" defaultTitle="Tổng quan tác giả" [navigation]="navigation" avatarSrc="/assets/author-suite/author-avatar.svg" userName="Lâm Phạm" userRole="Tác giả" [notificationCount]="4" searchPlaceholder="Tìm kiếm..." primaryActionLabel="＋ Viết truyện mới" primaryActionRoute="/author/stories/new" />`,
    layoutInputs: `readonly navigation = AUTHOR_NAVIGATION;`, configName: 'AUTHOR_NAVIGATION', configFile: 'author-navigation.config.ts',
    config: [['Tổng quan','/author','▦',true],['Truyện của tôi','/author/stories','▤'],['Quản lý chương','/author/stories/1/chapters','☷'],['Tạo truyện','/author/stories/new','✎'],['Thống kê','/author/analytics','⌁'],['Doanh thu','/author/revenue','₫'],['Tin nhắn','/author/messages','✉'],['Thông báo','/author/notifications','♢'],['Hồ sơ tác giả','/author/profile','◉'],['Cài đặt','/author/settings','⚙'],['Hỗ trợ','/author/support','?'],['Cộng đồng','/author/community','♧']],
    pages: [
      ['overview','Tổng quan tác giả | QuanLyTruyen','Tổng quan tác giả','Hiệu suất nội dung và hoạt động gần đây.'],['stories','Truyện của tôi | QuanLyTruyen','Truyện của tôi','Quản lý toàn bộ tác phẩm đang phát hành.'],['chapters','Quản lý chương | QuanLyTruyen','Quản lý chương','Lập lịch, chỉnh sửa và xuất bản chương.'],['editor','Tạo truyện | QuanLyTruyen','Tạo / Chỉnh sửa truyện','Biên tập thông tin và nội dung tác phẩm.'],['analytics','Thống kê tác giả | QuanLyTruyen','Thống kê chi tiết','Phân tích lượt đọc và tăng trưởng độc giả.'],['revenue','Doanh thu tác giả | QuanLyTruyen','Doanh thu','Theo dõi thu nhập và lịch sử thanh toán.'],['messages','Tin nhắn độc giả | QuanLyTruyen','Tin nhắn độc giả','Trao đổi với cộng đồng người đọc.'],['notifications','Thông báo tác giả | QuanLyTruyen','Thông báo','Các cập nhật quan trọng cho tác giả.'],['profile','Hồ sơ tác giả | QuanLyTruyen','Hồ sơ tác giả','Quản lý thông tin công khai của tác giả.'],['settings','Cài đặt tác giả | QuanLyTruyen','Cài đặt','Thiết lập tài khoản và tùy chọn làm việc.'],['support','Hỗ trợ tác giả | QuanLyTruyen','Trung tâm hỗ trợ','Tài liệu và kênh hỗ trợ vận hành.'],['community','Cộng đồng tác giả | QuanLyTruyen','Cộng đồng tác giả','Kết nối và chia sẻ kinh nghiệm sáng tác.'],
    ],
  },
  {
    id: 'account-center', oldPrefix: 'AccountCenter', newPrefix: 'Account', oldPageDir: 'account-center-page', rootClass: 'account-center', facade: 'AccountCenterFacade', adapter: 'AccountCenterViewModel', layoutClass: 'AccountCenterLayoutComponent', layoutSelector: 'app-account-center-layout', styleFile: 'account-center.pages.scss',
    layoutTemplate: `<app-workspace-layout variant="account" brandCaption="Tài khoản" defaultTitle="Tổng quan tài khoản" [navigation]="navigation" avatarSrc="/assets/account-center/avatar-small.svg" userName="Nguyễn Văn A" userRole="Thành viên" [notificationCount]="3" searchPlaceholder="Tìm kiếm truyện, tác giả..." />`,
    layoutInputs: `readonly navigation = ACCOUNT_NAVIGATION;`, configName: 'ACCOUNT_NAVIGATION', configFile: 'account-navigation.config.ts',
    config: [['Tổng quan','/account','▦',true],['Lịch sử đọc','/account/history','◴'],['Thư viện','/account/library','▤'],['Đang theo dõi','/account/following','♡'],['Đánh giá','/account/reviews','☆'],['Bình luận','/account/comments','◌'],['Thông tin tài khoản','/account/profile','♙'],['Bảo mật','/account/security','▣'],['Thông báo','/account/notifications','♢'],['Giao dịch','/account/transactions','₫']],
    pages: [
      ['overview','Tổng quan tài khoản | QuanLyTruyen','Tổng quan tài khoản','Quản lý hồ sơ, hoạt động đọc và quyền lợi thành viên.'],['history','Lịch sử đọc | QuanLyTruyen','Lịch sử đọc','Tiếp tục những nội dung bạn đã xem gần đây.'],['library','Thư viện của tôi | QuanLyTruyen','Thư viện của tôi','Tổ chức danh sách truyện cá nhân.'],['following','Truyện theo dõi | QuanLyTruyen','Truyện theo dõi','Nhận cập nhật từ các tác phẩm yêu thích.'],['reviews','Đánh giá của tôi | QuanLyTruyen','Đánh giá của tôi','Quản lý các đánh giá đã đăng.'],['comments','Bình luận của tôi | QuanLyTruyen','Bình luận của tôi','Theo dõi các thảo luận của bạn.'],['profile','Thông tin tài khoản | QuanLyTruyen','Thông tin tài khoản','Cập nhật hồ sơ và thông tin liên hệ.'],['security','Bảo mật | QuanLyTruyen','Bảo mật','Mật khẩu, phiên đăng nhập và xác thực.'],['notifications','Thông báo | QuanLyTruyen','Thông báo','Thiết lập kênh và loại thông báo.'],['transactions','Lịch sử giao dịch | QuanLyTruyen','Lịch sử giao dịch','Theo dõi xu và các khoản thanh toán.'],
    ],
  },
  {
    id: 'public-site', oldPrefix: 'PublicSite', newPrefix: 'Public', oldPageDir: 'public-site-page', rootClass: 'public-site', facade: 'PublicSiteFacade', adapter: 'PublicSiteViewModel', layoutClass: 'PublicSiteLayoutComponent', layoutSelector: 'app-public-site-layout', styleFile: 'public-site.pages.scss',
    layoutTemplate: `<app-public-layout [navigation]="navigation" />`, layoutInputs: `readonly navigation = PUBLIC_NAVIGATION;`, configName: 'PUBLIC_NAVIGATION', configFile: 'public-navigation.config.ts',
    config: [['Trang chủ','/', '', true],['Thể loại','/genres',''],['Xếp hạng','/rankings',''],['Truyện mới','/search',''],['Tác giả','/authors/huyen-huyen','']],
    pages: [
      ['home','QuanLyTruyen - Đọc truyện online','Trang chủ',''],['genres','Thể loại truyện | QuanLyTruyen','Thể loại',''],['search','Tìm kiếm truyện | QuanLyTruyen','Tìm kiếm',''],['rankings','Bảng xếp hạng | QuanLyTruyen','Xếp hạng',''],['story','Chi tiết truyện | QuanLyTruyen','Chi tiết truyện',''],['chapters','Danh sách chương | QuanLyTruyen','Danh sách chương',''],['reader','Đọc truyện | QuanLyTruyen','Đọc truyện',''],['comments','Bình luận chương | QuanLyTruyen','Bình luận',''],['author','Tác giả | QuanLyTruyen','Tác giả',''],['about','Giới thiệu | QuanLyTruyen','Giới thiệu',''],['guide','Hướng dẫn | QuanLyTruyen','Hướng dẫn',''],['notfound','Không tìm thấy trang | QuanLyTruyen','Không tìm thấy trang',''],
    ],
  },
];

function convertFacade(def, baseSource) {
  let source = baseSource;
  source = source.replace(/from '\.\.\/\.\.\/\.\.\/\.\.\/shared\//g, "from '../../../shared/");
  const angularImport = source.match(/import\s*\{([\s\S]*?)\}\s*from\s*'@angular\/core';/m);
  if (!angularImport) fail(`Không tìm thấy Angular import trong base ${def.id}`);
  const coreNames = angularImport[1]
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (!coreNames.includes('Injectable')) coreNames.push('Injectable');
  source = source.replace(angularImport[0], `import { ${[...new Set(coreNames)].sort().join(', ')} } from '@angular/core';`);
  const baseClass = `${def.oldPrefix}PageBase`;
  source = source.replace(`export abstract class ${baseClass}`, `@Injectable()\nexport class ${def.facade}`);
  return source;
}

function extractFacadeMembers(source, facadeName) {
  const classIndex = source.indexOf(`export class ${facadeName}`);
  if (classIndex < 0) fail(`Không tìm thấy facade ${facadeName}`);
  const body = source.slice(classIndex);
  const fields = [...body.matchAll(/^\s{2}readonly\s+([A-Za-z_$][\w$]*)/gm)].map((match) => match[1]);
  const methods = [...body.matchAll(/^\s{2}([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*:\s*[^=\n{]+\{/gm)]
    .map((match) => match[1])
    .filter((name) => name !== 'constructor');
  return { fields: [...new Set(fields)], methods: [...new Set(methods)] };
}

function createViewModel(def, facadeSource) {
  const { fields, methods } = extractFacadeMembers(facadeSource, def.facade);
  const lines = [
    `import { inject } from '@angular/core';`,
    `import { ${def.facade} } from './${def.id}.facade';`,
    '',
    `/** Transitional presentation adapter. State and data live in ${def.facade}. */`,
    `export abstract class ${def.adapter} {`,
    `  protected readonly facade = inject(${def.facade});`,
  ];
  for (const name of fields) lines.push(`  readonly ${name} = this.facade.${name};`);
  for (const name of methods) lines.push(`  readonly ${name} = this.facade.${name}.bind(this.facade);`);
  lines.push('}');
  write(`src/app/features/${def.id}/state/${def.id}-view-model.ts`, lines.join('\n'));
}

function createNavigationConfig(def) {
  const typeImport = def.id === 'public-site'
    ? `import { PublicNavigationItem } from '../../../layouts/public-layout/public-layout.component';`
    : `import { WorkspaceNavigationItem } from '../../../layouts/workspace-layout/workspace-layout.component';`;
  const typeName = def.id === 'public-site' ? 'PublicNavigationItem' : 'WorkspaceNavigationItem';
  const items = def.config.map(([label, route, icon, exact]) => {
    const fields = [`label: ${JSON.stringify(label)}`, `route: ${JSON.stringify(route)}`];
    if (def.id !== 'public-site') fields.push(`icon: ${JSON.stringify(icon)}`);
    if (exact) fields.push('exact: true');
    return `  { ${fields.join(', ')} },`;
  }).join('\n');
  write(`src/app/features/${def.id}/config/${def.configFile}`, `${typeImport}\n\nexport const ${def.configName}: readonly ${typeName}[] = [\n${items}\n];`);
}

function createFeatureLayout(def) {
  const sharedLayoutImport = def.id === 'public-site'
    ? `import { PublicLayoutComponent } from '../../../../layouts/public-layout/public-layout.component';`
    : `import { WorkspaceLayoutComponent } from '../../../../layouts/workspace-layout/workspace-layout.component';`;
  const sharedLayoutClass = def.id === 'public-site' ? 'PublicLayoutComponent' : 'WorkspaceLayoutComponent';
  const configPath = `../../config/${def.configFile.replace(/\.ts$/, '')}`;
  write(
    `src/app/features/${def.id}/layouts/${def.id}-layout/${def.id}-layout.component.ts`,
    `import { ChangeDetectionStrategy, Component, ViewEncapsulation } from '@angular/core';
${sharedLayoutImport}
import { ${def.facade} } from '../../state/${def.id}.facade';
import { ${def.configName} } from '${configPath}';

@Component({
  selector: '${def.layoutSelector}',
  standalone: true,
  imports: [${sharedLayoutClass}],
  providers: [${def.facade}],
  templateUrl: './${def.id}-layout.component.html',
  styleUrls: ['../../styles/${def.styleFile}'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ${def.layoutClass} {
  ${def.layoutInputs}
}`,
  );
  write(`src/app/features/${def.id}/layouts/${def.id}-layout/${def.id}-layout.component.html`, def.layoutTemplate);
}

function moveFeaturePages(def) {
  const oldDirRel = `src/app/features/${def.id}/pages/${def.oldPageDir}`;
  if (!exists(oldDirRel)) fail(`Thiếu thư mục nguồn ${oldDirRel}. Hãy chạy script này sau bản refactor v2.`);
  const baseRel = `${oldDirRel}/${def.oldPageDir}.base.ts`;
  const scssRel = `${oldDirRel}/${def.oldPageDir}.component.scss`;
  if (!exists(baseRel) || !exists(scssRel)) fail(`Thiếu base/scss của ${def.id}`);

  const facadeSource = convertFacade(def, read(baseRel));
  write(`src/app/features/${def.id}/state/${def.id}.facade.ts`, facadeSource);
  createViewModel(def, facadeSource);
  const rawFeatureStyle = read(scssRel);
  const scopedFeatureStyle = def.id === 'public-site'
    ? rawFeatureStyle
    : rawFeatureStyle.replaceAll(`.${def.rootClass}`, `.workspace-layout.${def.rootClass} .workspace-content`);
  write(`src/app/features/${def.id}/styles/${def.styleFile}`, scopedFeatureStyle);

  for (const [key] of def.pages) {
    const oldTs = `${oldDirRel}/${def.oldPageDir}.${key}-view.component.ts`;
    const oldHtml = `${oldDirRel}/${def.oldPageDir}.${key}-view.component.html`;
    if (!exists(oldTs) || !exists(oldHtml)) fail(`Thiếu view ${def.id}/${key}`);

    const keyPascal = key === 'notfound' ? 'NotFound' : pascal(key);
    const oldClass = `${def.oldPrefix}${keyPascal}ViewComponent`;
    const newClass = `${def.newPrefix}${keyPascal}PageComponent`;
    const newBase = `${def.id}-view-model`;
    const newFileBase = `${key}-page.component`;
    let html = enhanceTemplate(read(oldHtml));
    const uiImports = sharedUiImportsForTemplate(html);

    let ts = read(oldTs);
    ts = ts.replace(new RegExp(`import\\s*\\{\\s*${def.oldPrefix}PageBase\\s*\\}\\s*from\\s*['\"]\\./${def.oldPageDir}\\.base['\"];?`), `import { ${def.adapter} } from '../../state/${newBase}';`);
    ts = ts.replace(new RegExp(`export class ${oldClass} extends ${def.oldPrefix}PageBase`), `export class ${newClass} extends ${def.adapter}`);
    ts = ts.replace(new RegExp(oldClass, 'g'), newClass);
    ts = ts.replace(/selector\s*:\s*['"][^'"]+['"]/, `selector: 'app-${def.id.replace(/-center|-suite|-site/g, '')}-${key}-page'`);
    ts = ts.replace(/templateUrl\s*:\s*['"][^'"]+['"]/, `templateUrl: './${newFileBase}.html'`);
    if (uiImports.length) {
      ts = addDecoratorImport(ts, uiImports, '../../../../shared/ui');
      ts = addStandaloneImports(ts, uiImports);
    }

    write(`src/app/features/${def.id}/pages/${key}/${newFileBase}.ts`, ts);
    write(`src/app/features/${def.id}/pages/${key}/${newFileBase}.html`, html);
  }

  archive(oldDirRel, 'legacy-feature-shells');
  createNavigationConfig(def);
  createFeatureLayout(def);
}


function findMatchingBrace(text, openIndex) {
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = openIndex; index < text.length; index += 1) {
    const char = text[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return index;
    }
  }
  fail(`Không tìm thấy dấu } cho auth template tại ${openIndex}`);
}

function migrateAuth() {
  const oldDir = 'src/app/features/auth/pages/auth-page';
  const oldTs = `${oldDir}/auth-page.component.ts`;
  const oldHtml = `${oldDir}/auth-page.component.html`;
  const oldScss = `${oldDir}/auth-page.component.scss`;
  if (!exists(oldTs) || !exists(oldHtml) || !exists(oldScss)) {
    fail('Thiếu auth-page nguồn để tách login/register.');
  }

  const htmlSource = read(oldHtml);
  const marker = '@if (isLogin())';
  const markerIndex = htmlSource.indexOf(marker);
  const loginOpen = htmlSource.indexOf('{', markerIndex);
  const loginClose = findMatchingBrace(htmlSource, loginOpen);
  const elseIndex = htmlSource.indexOf('@else', loginClose);
  const registerOpen = htmlSource.indexOf('{', elseIndex);
  const registerClose = findMatchingBrace(htmlSource, registerOpen);
  if (markerIndex < 0 || loginOpen < 0 || elseIndex < 0 || registerOpen < 0) {
    fail('Không tách được @if login/register trong auth-page.');
  }

  let loginHtml = htmlSource.slice(loginOpen + 1, loginClose).trim();
  let registerHtml = htmlSource.slice(registerOpen + 1, registerClose).trim();
  loginHtml = loginHtml
    .replace(/<section class="auth-card login-card">/, '<app-auth-card class="login-card">')
    .replace(/<\/section>\s*\n\s*<p class="switch-copy">/, '</app-auth-card>\n\n        <p class="switch-copy">')
    .replace(/<div class="social-grid">[\s\S]*?<\/div>\s*\n\s*<\/app-auth-card>/, '<app-social-auth-buttons />\n        </app-auth-card>')
    .replace(/<footer class="login-benefits">[\s\S]*?<\/footer>/, '<app-auth-benefits class="login-benefits" variant="login" [benefits]="footerBenefits" />')
    .replace(/href="(\/auth\/[^"]+)"/g, 'routerLink="$1"');
  registerHtml = registerHtml
    .replace(/<section class="auth-card register-card">/, '<app-auth-card class="register-card">')
    .replace(/<div class="social-grid">[\s\S]*?<\/div>\s*\n\s*<p class="register-switch-copy">/, '<app-social-auth-buttons />\n\n          <p class="register-switch-copy">')
    .replace(/<\/section>\s*\n\s*<\/section>\s*\n\s*<aside class="register-benefits">[\s\S]*?<\/aside>/, '</app-auth-card>\n      </section>\n\n      <app-auth-benefits class="register-benefits" variant="register" [benefits]="registerBenefits" />')
    .replace(/href="(\/auth\/[^"]+)"/g, 'routerLink="$1"');
  loginHtml = enhanceTemplate(loginHtml);
  registerHtml = enhanceTemplate(registerHtml);

  copyFile(oldScss, 'src/app/features/auth/styles/auth.pages.scss');
  archive(oldDir, 'legacy-feature-shells');
  for (const directory of ['login-page', 'register-page', 'forgot-password-page', 'reset-password-page', 'verify-email-page', 'change-email-confirm-page']) {
    archive(`src/app/features/auth/pages/${directory}`, 'scaffolding');
  }
  for (const directory of ['auth-card', 'password-strength', 'verification-notice']) {
    archive(`src/app/features/auth/components/${directory}`, 'scaffolding');
  }

  write(
    'src/app/features/auth/models/auth-benefit.model.ts',
    `import { AuthIconName } from '../../../shared/ui/auth-icon/auth-icon.component';\n\nexport interface AuthBenefit {\n  readonly title: string;\n  readonly description: string;\n  readonly icon: AuthIconName;\n  readonly tone: string;\n}`,
  );

  write(
    'src/app/features/auth/components/auth-card/auth-card.component.ts',
    `import { ChangeDetectionStrategy, Component } from '@angular/core';\n\n@Component({\n  selector: 'app-auth-card',\n  standalone: true,\n  template: '<ng-content />',\n  host: { class: 'auth-card' },\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class AuthCardComponent {}`,
  );

  write(
    'src/app/features/auth/components/social-auth-buttons/social-auth-buttons.component.ts',
    `import { ChangeDetectionStrategy, Component } from '@angular/core';\nimport { ButtonDirective } from '../../../../shared/ui';\n\n@Component({\n  selector: 'app-social-auth-buttons',\n  standalone: true,\n  imports: [ButtonDirective],\n  templateUrl: './social-auth-buttons.component.html',\n  host: { class: 'social-grid' },\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class SocialAuthButtonsComponent {}`,
  );
  write(
    'src/app/features/auth/components/social-auth-buttons/social-auth-buttons.component.html',
    `<button appButton type="button"><b class="google">G</b>Google</button>\n<button appButton type="button"><b class="facebook">f</b>Facebook</button>\n<button appButton type="button"><b class="apple">●</b>Apple</button>`,
  );

  write(
    'src/app/features/auth/components/auth-benefits/auth-benefits.component.ts',
    `import { ChangeDetectionStrategy, Component, Input } from '@angular/core';\nimport { AuthIconComponent } from '../../../../shared/ui/auth-icon/auth-icon.component';\nimport { AuthBenefit } from '../../models/auth-benefit.model';\n\n@Component({\n  selector: 'app-auth-benefits',\n  standalone: true,\n  imports: [AuthIconComponent],\n  templateUrl: './auth-benefits.component.html',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class AuthBenefitsComponent {\n  @Input() benefits: readonly AuthBenefit[] = [];\n  @Input() variant: 'login' | 'register' = 'login';\n}`,
  );
  write(
    'src/app/features/auth/components/auth-benefits/auth-benefits.component.html',
    `@for (benefit of benefits; track benefit.title) {\n  <article>\n    <span [class]="variant === 'register' ? 'register-benefit-icon register-benefit-icon--' + benefit.tone : 'benefit-icon benefit-icon--' + benefit.tone">\n      <app-auth-icon [name]="benefit.icon" />\n    </span>\n    <div><strong>{{ benefit.title }}</strong><p>{{ benefit.description }}</p></div>\n  </article>\n}`,
  );

  write(
    'src/app/features/auth/layouts/auth-layout/auth-layout.component.ts',
    `import { ChangeDetectionStrategy, Component, ViewEncapsulation, signal } from '@angular/core';\nimport { RouterLink, RouterOutlet } from '@angular/router';\nimport { AppLogoComponent, ButtonDirective } from '../../../../shared/ui';\nimport { AuthIconComponent } from '../../../../shared/ui/auth-icon/auth-icon.component';\n\n@Component({\n  selector: 'app-auth-layout',\n  standalone: true,\n  imports: [RouterLink, RouterOutlet, AppLogoComponent, AuthIconComponent, ButtonDirective],\n  templateUrl: './auth-layout.component.html',\n  styleUrls: ['../../styles/auth.pages.scss'],\n  encapsulation: ViewEncapsulation.None,\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class AuthLayoutComponent {\n  readonly darkMode = signal(true);\n\n  toggleTheme(): void {\n    this.darkMode.update((enabled) => !enabled);\n  }\n}`,
  );
  write(
    'src/app/features/auth/layouts/auth-layout/auth-layout.component.html',
    `<div class="auth-page" [class.auth-page--light]="!darkMode()">\n  <header class="auth-header">\n    <a class="auth-brand" routerLink="/"><app-logo [compact]="true" /></a>\n    <button appButton class="theme-button" type="button" (click)="toggleTheme()"><app-auth-icon name="moon" />{{ darkMode() ? 'Chế độ tối' : 'Chế độ sáng' }}</button>\n  </header>\n  <router-outlet />\n</div>`,
  );

  const loginUiImports = sharedUiImportsForTemplate(loginHtml);
  let loginTs = `import { ChangeDetectionStrategy, Component, signal } from '@angular/core';\nimport { RouterLink } from '@angular/router';\nimport { AuthIconComponent } from '../../../../shared/ui/auth-icon/auth-icon.component';\nimport { AuthBenefit } from '../../models/auth-benefit.model';\nimport { AuthBenefitsComponent } from '../../components/auth-benefits/auth-benefits.component';\nimport { AuthCardComponent } from '../../components/auth-card/auth-card.component';\nimport { SocialAuthButtonsComponent } from '../../components/social-auth-buttons/social-auth-buttons.component';\n\n@Component({\n  selector: 'app-login-page',\n  standalone: true,\n  imports: [RouterLink, AuthIconComponent, AuthBenefitsComponent, AuthCardComponent, SocialAuthButtonsComponent],\n  templateUrl: './login-page.component.html',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class LoginPageComponent {\n  readonly showPassword = signal(false);\n  readonly rememberMe = signal(true);\n  readonly footerBenefits: readonly AuthBenefit[] = [\n    { title: 'Bảo mật tuyệt đối', description: 'Thông tin của bạn được bảo mật với công nghệ tiên tiến', icon: 'shield', tone: 'violet' },\n    { title: 'Đọc mọi lúc, mọi nơi', description: 'Đồng bộ tiến độ trên mọi thiết bị, trải nghiệm liền mạch', icon: 'spark', tone: 'violet' },\n    { title: 'Cộng đồng độc giả', description: 'Kết nối với hàng triệu độc giả đam mê truyện', icon: 'community', tone: 'pink' },\n    { title: 'Kho truyện khổng lồ', description: 'Hàng ngàn truyện hay đang chờ bạn khám phá', icon: 'book', tone: 'pink' },\n  ];\n\n  togglePassword(): void { this.showPassword.update((visible) => !visible); }\n}`;
  if (loginUiImports.length) {
    loginTs = addDecoratorImport(loginTs, loginUiImports, '../../../../shared/ui');
    loginTs = addStandaloneImports(loginTs, loginUiImports);
  }
  write('src/app/features/auth/pages/login/login-page.component.ts', loginTs);
  write('src/app/features/auth/pages/login/login-page.component.html', loginHtml);

  const registerUiImports = sharedUiImportsForTemplate(registerHtml);
  let registerTs = `import { ChangeDetectionStrategy, Component, signal } from '@angular/core';\nimport { RouterLink } from '@angular/router';\nimport { AuthIconComponent } from '../../../../shared/ui/auth-icon/auth-icon.component';\nimport { AuthBenefit } from '../../models/auth-benefit.model';\nimport { AuthBenefitsComponent } from '../../components/auth-benefits/auth-benefits.component';\nimport { AuthCardComponent } from '../../components/auth-card/auth-card.component';\nimport { SocialAuthButtonsComponent } from '../../components/social-auth-buttons/social-auth-buttons.component';\n\n@Component({\n  selector: 'app-register-page',\n  standalone: true,\n  imports: [RouterLink, AuthIconComponent, AuthBenefitsComponent, AuthCardComponent, SocialAuthButtonsComponent],\n  templateUrl: './register-page.component.html',\n  changeDetection: ChangeDetectionStrategy.OnPush,\n})\nexport class RegisterPageComponent {\n  readonly showPassword = signal(false);\n  readonly showConfirmPassword = signal(false);\n  readonly acceptedTerms = signal(true);\n  readonly registerBenefits: readonly AuthBenefit[] = [\n    { title: 'Miễn phí hoàn toàn', description: 'Đăng ký và sử dụng tất cả các tính năng miễn phí', icon: 'gift', tone: 'violet' },\n    { title: 'Không spam', description: 'Chúng tôi cam kết không gửi email rác đến bạn', icon: 'shield', tone: 'green' },\n    { title: 'Bảo mật thông tin', description: 'Thông tin cá nhân của bạn luôn được bảo vệ', icon: 'lock', tone: 'blue' },\n    { title: 'Cộng đồng lớn mạnh', description: 'Tham gia cộng đồng với hàng triệu độc giả khác', icon: 'community', tone: 'orange' },\n  ];\n\n  togglePassword(): void { this.showPassword.update((visible) => !visible); }\n  toggleConfirmPassword(): void { this.showConfirmPassword.update((visible) => !visible); }\n}`;
  if (registerUiImports.length) {
    registerTs = addDecoratorImport(registerTs, registerUiImports, '../../../../shared/ui');
    registerTs = addStandaloneImports(registerTs, registerUiImports);
  }
  write('src/app/features/auth/pages/register/register-page.component.ts', registerTs);
  write('src/app/features/auth/pages/register/register-page.component.html', registerHtml);

  write(
    'src/app/features/auth/auth.routes.ts',
    `import { Routes } from '@angular/router';\n\nexport const AUTH_ROUTES: Routes = [\n  {\n    path: 'auth',\n    loadComponent: () => import('./layouts/auth-layout/auth-layout.component').then((module) => module.AuthLayoutComponent),\n    children: [\n      { path: '', pathMatch: 'full', redirectTo: 'login' },\n      { path: 'login', title: 'Đăng nhập | QuanLyTruyen', loadComponent: () => import('./pages/login/login-page.component').then((module) => module.LoginPageComponent) },\n      { path: 'register', title: 'Đăng ký | QuanLyTruyen', loadComponent: () => import('./pages/register/register-page.component').then((module) => module.RegisterPageComponent) },\n    ],\n  },\n];`,
  );
}

function pageImport(def, key) {
  const keyPascal = key === 'notfound' ? 'NotFound' : pascal(key);
  return `import('./pages/${key}/${key}-page.component').then((module) => module.${def.newPrefix}${keyPascal}PageComponent)`;
}

function routeData(title, pageTitle, description = '', extras = '') {
  const fields = [`pageTitle: ${JSON.stringify(pageTitle)}`];
  if (description) fields.push(`pageDescription: ${JSON.stringify(description)}`);
  if (extras) fields.push(extras);
  return `{ ${fields.join(', ')} }`;
}


function walkFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walkFiles(full) : [full];
  });
}

function relativeImport(fromFile, targetWithoutExtension) {
  let specifier = path.relative(path.dirname(fromFile), targetWithoutExtension).replaceAll('\\', '/');
  if (!specifier.startsWith('.')) specifier = `./${specifier}`;
  return specifier;
}

function relocateFeatureSpecificUi() {
  const mappings = [
    ['account-center-icon', 'account-center'],
    ['admin-center-icon', 'admin-center'],
    ['auth-icon', 'auth'],
    ['public-site-icon', 'public-site'],
    ['site-icon', 'public-site'],
  ];

  for (const [componentName, featureName] of mappings) {
    const sourceRel = `src/app/shared/ui/${componentName}`;
    if (!exists(sourceRel)) continue;
    const targetRel = `src/app/features/${featureName}/components/${componentName}`;
    const targetAbs = path.join(root, targetRel);
    fs.mkdirSync(path.dirname(targetAbs), { recursive: true });
    fs.renameSync(path.join(root, sourceRel), targetAbs);
  }

  const sourceFiles = walkFiles(appRoot).filter((file) => file.endsWith('.ts'));
  for (const file of sourceFiles) {
    let source = fs.readFileSync(file, 'utf8');
    let changed = false;
    for (const [componentName, featureName] of mappings) {
      const target = path.join(appRoot, 'features', featureName, 'components', componentName, `${componentName}.component`);
      const importPath = relativeImport(file, target);
      const pattern = new RegExp(`(['\"])(?:[^'\"]*\/)?shared\/ui\/${componentName}\/${componentName}\\.component\\1`, 'g');
      const next = source.replace(pattern, (_match, quote) => `${quote}${importPath}${quote}`);
      if (next !== source) {
        source = next;
        changed = true;
      }
    }
    if (changed) fs.writeFileSync(file, source, 'utf8');
  }

  for (const stale of ['app-icon', 'portal-icon', 'reader-account-icon']) {
    archive(`src/app/shared/ui/${stale}`, 'unused-ui');
  }
}

function removeSpeculativeScaffolding() {
  const externalTs = walkFiles(appRoot).filter((file) => file.endsWith('.ts'));
  const referenced = (segment) => externalTs.some((file) => {
    if (!fs.existsSync(file)) return false;
    const rel = path.relative(appRoot, file).replaceAll('\\', '/');
    if (rel.startsWith(`${segment}/`)) return false;
    const source = fs.readFileSync(file, 'utf8');
    return source.includes(`@${segment}/`) || source.includes(`/app/${segment}/`) || source.includes(`../${segment}/`) || source.includes(`./${segment}/`);
  });

  for (const layer of ['core', 'domains']) {
    if (exists(`src/app/${layer}`) && !referenced(layer)) {
      archive(`src/app/${layer}`, 'speculative-architecture');
      write(
        `src/app/${layer}/README.md`,
        layer === 'core'
          ? '# Core\n\nChỉ đặt singleton infrastructure thực sự được ứng dụng sử dụng tại đây. Không tạo service/interceptor giả hoặc TODO để làm đầy cây thư mục.\n'
          : '# Domains\n\nTạo domain model, API và store khi feature bắt đầu dùng dữ liệu nghiệp vụ thật. Domain không được import UI hoặc feature.\n',
      );
    }
  }

  for (const group of ['constants', 'directives', 'forms', 'pipes', 'testing', 'types', 'utils']) {
    const rel = `src/app/shared/${group}`;
    if (!exists(rel)) continue;
    const groupReferenced = externalTs.some((file) => {
      if (!fs.existsSync(file)) return false;
      const fileRel = path.relative(appRoot, file).replaceAll('\\', '/');
      if (fileRel.startsWith(`shared/${group}/`)) return false;
      const source = fs.readFileSync(file, 'utf8');
      return source.includes(`shared/${group}/`) || source.includes(`@shared/${group}/`);
    });
    if (!groupReferenced) archive(rel, 'speculative-architecture');
  }
}

function createRoutes() {
  const admin = featureDefinitions[0];
  const adminPage = Object.fromEntries(admin.pages.map((item) => [item[0], item]));
  write(
    'src/app/features/admin-center/admin-center.routes.ts',
    `import { Routes } from '@angular/router';

const loadLayout = () => import('./layouts/admin-center-layout/admin-center-layout.component').then((module) => module.AdminCenterLayoutComponent);

export const ADMIN_CENTER_ROUTES: Routes = [
  {
    path: 'dashboard',
    loadComponent: loadLayout,
    children: [
      { path: '', pathMatch: 'full', title: ${JSON.stringify(adminPage.overview[1])}, data: ${routeData(adminPage.overview[1], adminPage.overview[2], adminPage.overview[3])}, loadComponent: () => ${pageImport(admin, 'overview')} },
    ],
  },
  {
    path: 'admin',
    loadComponent: loadLayout,
    children: [
      { path: '', pathMatch: 'full', title: ${JSON.stringify(adminPage.overview[1])}, data: ${routeData(adminPage.overview[1], adminPage.overview[2], adminPage.overview[3])}, loadComponent: () => ${pageImport(admin, 'overview')} },
      { path: 'stories', title: ${JSON.stringify(adminPage.stories[1])}, data: ${routeData(adminPage.stories[1], adminPage.stories[2], adminPage.stories[3])}, loadComponent: () => ${pageImport(admin, 'stories')} },
      { path: 'stories/:id/chapters', title: ${JSON.stringify(adminPage.chapters[1])}, data: ${routeData(adminPage.chapters[1], adminPage.chapters[2], adminPage.chapters[3])}, loadComponent: () => ${pageImport(admin, 'chapters')} },
      { path: 'users', title: ${JSON.stringify(adminPage.users[1])}, data: ${routeData(adminPage.users[1], adminPage.users[2], adminPage.users[3])}, loadComponent: () => ${pageImport(admin, 'users')} },
      { path: 'authors', title: ${JSON.stringify(adminPage.authors[1])}, data: ${routeData(adminPage.authors[1], adminPage.authors[2], adminPage.authors[3])}, loadComponent: () => ${pageImport(admin, 'authors')} },
      { path: 'comments', title: ${JSON.stringify(adminPage.comments[1])}, data: ${routeData(adminPage.comments[1], adminPage.comments[2], adminPage.comments[3])}, loadComponent: () => ${pageImport(admin, 'comments')} },
      { path: 'reports', title: ${JSON.stringify(adminPage.reports[1])}, data: ${routeData(adminPage.reports[1], adminPage.reports[2], adminPage.reports[3])}, loadComponent: () => ${pageImport(admin, 'reports')} },
      { path: 'categories', title: ${JSON.stringify(adminPage.categories[1])}, data: ${routeData(adminPage.categories[1], adminPage.categories[2], adminPage.categories[3])}, loadComponent: () => ${pageImport(admin, 'categories')} },
      { path: 'transactions', title: ${JSON.stringify(adminPage.transactions[1])}, data: ${routeData(adminPage.transactions[1], adminPage.transactions[2], adminPage.transactions[3])}, loadComponent: () => ${pageImport(admin, 'transactions')} },
      { path: 'ads', title: ${JSON.stringify(adminPage.ads[1])}, data: ${routeData(adminPage.ads[1], adminPage.ads[2], adminPage.ads[3])}, loadComponent: () => ${pageImport(admin, 'ads')} },
      { path: 'settings', title: ${JSON.stringify(adminPage.settings[1])}, data: ${routeData(adminPage.settings[1], adminPage.settings[2], adminPage.settings[3])}, loadComponent: () => ${pageImport(admin, 'settings')} },
      { path: 'activity-logs', title: ${JSON.stringify(adminPage.activity[1])}, data: ${routeData(adminPage.activity[1], adminPage.activity[2], adminPage.activity[3])}, loadComponent: () => ${pageImport(admin, 'activity')} },
    ],
  },
];`,
  );

  const author = featureDefinitions[1];
  const authorPage = Object.fromEntries(author.pages.map((item) => [item[0], item]));
  write(
    'src/app/features/author-suite/author-suite.routes.ts',
    `import { Routes } from '@angular/router';

export const AUTHOR_SUITE_ROUTES: Routes = [
  {
    path: 'author',
    loadComponent: () => import('./layouts/author-suite-layout/author-suite-layout.component').then((module) => module.AuthorSuiteLayoutComponent),
    children: [
      { path: '', pathMatch: 'full', title: ${JSON.stringify(authorPage.overview[1])}, data: ${routeData(authorPage.overview[1], authorPage.overview[2], authorPage.overview[3])}, loadComponent: () => ${pageImport(author, 'overview')} },
      { path: 'stories', title: ${JSON.stringify(authorPage.stories[1])}, data: ${routeData(authorPage.stories[1], authorPage.stories[2], authorPage.stories[3])}, loadComponent: () => ${pageImport(author, 'stories')} },
      { path: 'stories/new', title: ${JSON.stringify(authorPage.editor[1])}, data: ${routeData(authorPage.editor[1], authorPage.editor[2], authorPage.editor[3])}, loadComponent: () => ${pageImport(author, 'editor')} },
      { path: 'stories/:id/edit', title: 'Chỉnh sửa truyện | QuanLyTruyen', data: ${routeData('', authorPage.editor[2], authorPage.editor[3])}, loadComponent: () => ${pageImport(author, 'editor')} },
      { path: 'stories/:id/chapters', title: ${JSON.stringify(authorPage.chapters[1])}, data: ${routeData(authorPage.chapters[1], authorPage.chapters[2], authorPage.chapters[3])}, loadComponent: () => ${pageImport(author, 'chapters')} },
      { path: 'analytics', title: ${JSON.stringify(authorPage.analytics[1])}, data: ${routeData(authorPage.analytics[1], authorPage.analytics[2], authorPage.analytics[3])}, loadComponent: () => ${pageImport(author, 'analytics')} },
      { path: 'revenue', title: ${JSON.stringify(authorPage.revenue[1])}, data: ${routeData(authorPage.revenue[1], authorPage.revenue[2], authorPage.revenue[3])}, loadComponent: () => ${pageImport(author, 'revenue')} },
      { path: 'messages', title: ${JSON.stringify(authorPage.messages[1])}, data: ${routeData(authorPage.messages[1], authorPage.messages[2], authorPage.messages[3])}, loadComponent: () => ${pageImport(author, 'messages')} },
      { path: 'notifications', title: ${JSON.stringify(authorPage.notifications[1])}, data: ${routeData(authorPage.notifications[1], authorPage.notifications[2], authorPage.notifications[3])}, loadComponent: () => ${pageImport(author, 'notifications')} },
      { path: 'profile', title: ${JSON.stringify(authorPage.profile[1])}, data: ${routeData(authorPage.profile[1], authorPage.profile[2], authorPage.profile[3])}, loadComponent: () => ${pageImport(author, 'profile')} },
      { path: 'settings', title: ${JSON.stringify(authorPage.settings[1])}, data: ${routeData(authorPage.settings[1], authorPage.settings[2], authorPage.settings[3])}, loadComponent: () => ${pageImport(author, 'settings')} },
      { path: 'support', title: ${JSON.stringify(authorPage.support[1])}, data: ${routeData(authorPage.support[1], authorPage.support[2], authorPage.support[3])}, loadComponent: () => ${pageImport(author, 'support')} },
      { path: 'community', title: ${JSON.stringify(authorPage.community[1])}, data: ${routeData(authorPage.community[1], authorPage.community[2], authorPage.community[3])}, loadComponent: () => ${pageImport(author, 'community')} },
    ],
  },
];`,
  );

  const account = featureDefinitions[2];
  const accountPage = Object.fromEntries(account.pages.map((item) => [item[0], item]));
  const accountChildren = account.pages.map(([key, title, pageTitle, description]) => {
    const childPath = key === 'overview' ? '' : key;
    const match = key === 'overview' ? `, pathMatch: 'full'` : '';
    return `      { path: '${childPath}'${match}, title: ${JSON.stringify(title)}, data: ${routeData(title, pageTitle, description)}, loadComponent: () => ${pageImport(account, key)} },`;
  }).join('\n');
  write(
    'src/app/features/account-center/account-center.routes.ts',
    `import { Routes } from '@angular/router';

export const ACCOUNT_CENTER_ROUTES: Routes = [
  {
    path: 'account',
    loadComponent: () => import('./layouts/account-center-layout/account-center-layout.component').then((module) => module.AccountCenterLayoutComponent),
    children: [
${accountChildren}
    ],
  },
];`,
  );

  const publicDef = featureDefinitions[3];
  const publicPage = Object.fromEntries(publicDef.pages.map((item) => [item[0], item]));
  const publicRoutes = [
    ['', 'home', "pathMatch: 'full'"], ['genres','genres',''], ['search','search',''], ['rankings','rankings',''], ['story/:slug/chapters','chapters',''], ['story/:slug/chapter/:chapter/comments','comments',''], ['read/:slug/:chapter','reader',"dataExtra: pageClass: 'reader-page'"], ['authors/:slug','author',''], ['about','about',''], ['guide','guide',''], ['404','notfound',"dataExtra: hideChrome: true, pageClass: 'not-found-page'"], ['story/:slug','story',''],
  ];
  const children = publicRoutes.map(([routePath, key, option]) => {
    const page = publicPage[key];
    const pathMatch = option.includes('pathMatch') ? `, pathMatch: 'full'` : '';
    let extra = '';
    if (option.includes('reader-page')) extra = `pageClass: 'reader-page'`;
    if (option.includes('hideChrome')) extra = `hideChrome: true, pageClass: 'not-found-page'`;
    return `      { path: '${routePath}'${pathMatch}, title: ${JSON.stringify(page[1])}, data: ${routeData(page[1], page[2], page[3], extra)}, loadComponent: () => ${pageImport(publicDef, key)} },`;
  }).join('\n');
  write(
    'src/app/features/public-site/public-site.routes.ts',
    `import { Routes } from '@angular/router';

export const PUBLIC_SITE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./layouts/public-site-layout/public-site-layout.component').then((module) => module.PublicSiteLayoutComponent),
    children: [
${children}
    ],
  },
];`,
  );

  write(
    'src/app/app.routes.ts',
    `import { Routes } from '@angular/router';
import { AUTH_ROUTES } from './features/auth/auth.routes';
import { ACCOUNT_CENTER_ROUTES } from './features/account-center/account-center.routes';
import { AUTHOR_SUITE_ROUTES } from './features/author-suite/author-suite.routes';
import { ADMIN_CENTER_ROUTES } from './features/admin-center/admin-center.routes';
import { PUBLIC_SITE_ROUTES } from './features/public-site/public-site.routes';

export const APP_ROUTES: Routes = [
  ...AUTH_ROUTES,
  ...ACCOUNT_CENTER_ROUTES,
  ...AUTHOR_SUITE_ROUTES,
  ...ADMIN_CENTER_ROUTES,
  ...PUBLIC_SITE_ROUTES,
  { path: '**', redirectTo: '404' },
];

export const routes = APP_ROUTES;`,
  );
}

function createBoundaryChecker() {
  write(
    'scripts/check-frontend-boundaries.mjs',
    `import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'src', 'app');
const violations = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

function layer(file) {
  const rel = path.relative(appRoot, file).replaceAll('\\\\', '/');
  const parts = rel.split('/');
  if (parts[0] === 'features') return { kind: 'feature', name: parts[1] };
  return { kind: parts[0], name: parts[0] };
}

function resolveTarget(file, specifier) {
  if (!specifier.startsWith('.')) return null;
  return path.resolve(path.dirname(file), specifier);
}

for (const file of walk(appRoot).filter((item) => item.endsWith('.ts') && !item.endsWith('.spec.ts') && !item.includes('.bak'))) {
  const sourceLayer = layer(file);
  const source = fs.readFileSync(file, 'utf8');
  const imports = [...source.matchAll(/(?:import|export)\\s+(?:[^'\"]+?\\s+from\\s+)?['\"]([^'\"]+)['\"]/g)].map((match) => match[1]);
  for (const specifier of imports) {
    const resolved = resolveTarget(file, specifier);
    if (!resolved || !resolved.startsWith(appRoot)) continue;
    const targetLayer = layer(resolved);
    let invalid = false;
    if (sourceLayer.kind === 'shared' && ['features', 'feature', 'domains', 'core', 'layouts'].includes(targetLayer.kind)) invalid = true;
    if (sourceLayer.kind === 'core' && ['feature', 'layouts'].includes(targetLayer.kind)) invalid = true;
    if (sourceLayer.kind === 'domains' && ['feature', 'layouts'].includes(targetLayer.kind)) invalid = true;
    if (sourceLayer.kind === 'layouts' && targetLayer.kind === 'feature') invalid = true;
    if (sourceLayer.kind === 'feature' && targetLayer.kind === 'feature' && sourceLayer.name !== targetLayer.name) invalid = true;
    if (invalid) violations.push(
      path.relative(root, file) + ' -> ' + specifier + ' (' + sourceLayer.kind + ':' + sourceLayer.name + ' -> ' + targetLayer.kind + ':' + targetLayer.name + ')',
    );
  }
}

if (violations.length) {
  console.error('Frontend boundary violations:');
  for (const violation of violations) console.error(' - ' + violation);
  process.exit(1);
}
console.log('Frontend boundaries: OK');`,
  );

  const packagePath = 'package.json';
  const packageJson = JSON.parse(read(packagePath));
  packageJson.scripts ||= {};
  packageJson.scripts['lint:boundaries'] = 'node scripts/check-frontend-boundaries.mjs';
  packageJson.scripts['verify:enterprise'] = 'npm run lint:boundaries && npm run build';
  write(packagePath, JSON.stringify(packageJson, null, 2));
}

function addTsConfigAliases() {
  const rel = 'tsconfig.json';
  const raw = read(rel);
  const withoutComments = raw
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
  const config = JSON.parse(withoutComments);
  config.compilerOptions ||= {};
  config.compilerOptions.baseUrl = '.';
  config.compilerOptions.paths = {
    '@app/*': ['src/app/*'],
    '@core/*': ['src/app/core/*'],
    '@domains/*': ['src/app/domains/*'],
    '@features/*': ['src/app/features/*'],
    '@layouts/*': ['src/app/layouts/*'],
    '@shared/*': ['src/app/shared/*'],
  };
  write(rel, JSON.stringify(config, null, 2));
}

function createArchitectureDoc() {
  write(
    'docs/architecture/FRONTEND_ENTERPRISE_ARCHITECTURE.md',
    `# Frontend enterprise architecture

## Dependency direction

\`app -> layouts/features -> domains/core/shared\`

- **core**: singleton infrastructure, HTTP, auth, configuration and cross-cutting services.
- **domains**: business contracts, models, mappers, APIs and stores. It must not import feature UI.
- **shared**: stateless UI primitives, directives, pipes and generic utilities. It must not know any domain or feature.
- **layouts**: reusable route shells. They render navigation, headers and \`router-outlet\`, but contain no business data.
- **features**: vertical business slices. Each feature owns routes, feature configuration, facade/state and leaf pages.

## Feature contract

Each migrated feature follows:

\`config / layouts / pages / state / styles / <feature>.routes.ts\`

- A route loads one leaf page instead of a giant page with \`@switch\`.
- A feature layout only configures a shared route shell.
- Mutable UI state and mock data are scoped through a feature facade provider.
- The temporary \`*-view-model.ts\` adapter preserves existing templates while state is moved out of components. New code should inject the facade directly.
- Shared visual behavior is applied through \`ButtonDirective\`, \`CardDirective\`, \`DataTableDirective\` and \`StatusBadgeDirective\`.

## Enforcement

Run \`npm run lint:boundaries\` to reject imports that violate layer direction or cross feature boundaries.
Run \`npm run verify:enterprise\` before merging.

## Next production step

The current facade data is still mock/demo data inherited from the original screens. Replace each mock collection with domain APIs/stores incrementally; do not move business-specific models into \`shared\`.
`,
  );
}

function validateResult() {
  const required = [
    'src/app/layouts/workspace-layout/workspace-layout.component.ts',
    'src/app/layouts/public-layout/public-layout.component.ts',
    'src/app/shared/ui/index.ts',
    'src/app/features/admin-center/pages/overview/overview-page.component.ts',
    'src/app/features/author-suite/pages/stories/stories-page.component.ts',
    'src/app/features/account-center/pages/profile/profile-page.component.ts',
    'src/app/features/public-site/pages/home/home-page.component.ts',
    'src/app/features/auth/pages/login/login-page.component.ts',
    'src/app/features/auth/pages/register/register-page.component.ts',
  ];
  for (const rel of required) if (!exists(rel)) fail(`Kết quả thiếu ${rel}`);

  const staleSwitches = featureDefinitions.flatMap((def) => {
    const featureRoot = path.join(appRoot, 'features', def.id);
    const files = [];
    function walk(dir) {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.html') && fs.readFileSync(full, 'utf8').includes('@switch (page())')) files.push(full);
      }
    }
    walk(featureRoot);
    return files;
  });
  if (staleSwitches.length) fail(`Vẫn còn shell @switch(page()): ${staleSwitches.join(', ')}`);

  return {
    features: featureDefinitions.length + 1,
    pages: featureDefinitions.reduce((total, def) => total + def.pages.length, 0) + 2,
    sharedUi: 10,
    layouts: 2,
  };
}

function main() {
  if (!fs.existsSync(path.join(root, 'angular.json'))) fail('ProjectRoot không phải Angular frontend.');
  if (fs.existsSync(path.join(root, '.frontend-enterprise-refactored'))) fail('Frontend đã được enterprise migration trước đó.');
  for (const def of featureDefinitions) {
    if (!exists(`src/app/features/${def.id}/pages/${def.oldPageDir}`)) {
      fail(`Không thấy output v2 cho ${def.id}. Script enterprise phải chạy sau Refactor-Frontend-OneShot-v2.`);
    }
  }

  archiveScaffolding();
  createSharedUi();
  createLayouts();
  for (const def of featureDefinitions) moveFeaturePages(def);
  migrateAuth();
  relocateFeatureSpecificUi();
  removeSpeculativeScaffolding();
  createRoutes();
  createBoundaryChecker();
  addTsConfigAliases();
  createArchitectureDoc();
  const result = validateResult();
  write('.frontend-enterprise-refactored', JSON.stringify({ migratedAt: new Date().toISOString(), ...result }, null, 2));
  process.stdout.write(JSON.stringify(result));
}

main();
