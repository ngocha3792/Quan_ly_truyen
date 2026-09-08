import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  inject,
  input,
  OnDestroy,
  output,
  signal,
} from '@angular/core';
import type { ChapterComment, ChapterComicMedia, ComicCommentRegion } from '../../domain/chapter-reader.models';

@Component({
  selector: 'app-chapter-image-slices',
  standalone: true,
  templateUrl: './chapter-image-slices.component.html',
  styleUrl: './chapter-image-slices.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChapterImageSlicesComponent implements OnDestroy {
  readonly media = input.required<ChapterComicMedia>();
  readonly comments = input<readonly ChapterComment[]>([]);
  readonly regionCommentCreate = output<{ body: string; region: ComicCommentRegion }>();
  protected readonly visible = signal<ReadonlySet<string>>(new Set());
  protected readonly loaded = signal<ReadonlySet<string>>(new Set());
  protected readonly pendingRegion = signal<ComicCommentRegion | null>(null);
  protected readonly draft = signal('');
  private readonly host = inject(ElementRef<HTMLElement>);
  private observer: IntersectionObserver | null = null;

  constructor() {
    afterNextRender(() => this.observeSlices());
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  protected markLoaded(id: string): void {
    this.loaded.update((current) => new Set([...current, id]));
  }

  protected selectRegion(event: MouseEvent): void {
    if ((event.target as HTMLElement).closest('button, form')) return;
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const width = 0.04;
    const height = Math.min(0.04, (rect.width / rect.height) * width);
    this.pendingRegion.set({
      x: Math.min(1 - width, Math.max(0, (event.clientX - rect.left) / rect.width - width / 2)),
      y: Math.min(1 - height, Math.max(0, (event.clientY - rect.top) / rect.height - height / 2)),
      width,
      height,
    });
  }

  protected submit(event: Event): void {
    event.preventDefault();
    const region = this.pendingRegion();
    const body = this.draft().trim();
    if (!region || !body) return;
    this.regionCommentCreate.emit({ body, region });
    this.pendingRegion.set(null);
    this.draft.set('');
  }

  protected regionComments(): readonly ChapterComment[] {
    return this.comments().filter((comment) => comment.region?.mediaAssetId === this.media().mediaAssetId);
  }

  private observeSlices(): void {
    if (typeof IntersectionObserver === 'undefined') {
      this.visible.set(new Set(this.media().slices.map((slice) => slice.id)));
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        this.visible.update((current) => {
          const next = new Set(current);
          for (const entry of entries) {
            const id = (entry.target as HTMLElement).dataset['sliceId'];
            if (!id) continue;
            if (entry.isIntersecting) next.add(id);
            else next.delete(id);
          }
          return next;
        });
      },
      { rootMargin: '100% 0px' },
    );
    for (const element of this.host.nativeElement.querySelectorAll('[data-slice-id]')) {
      this.observer.observe(element);
    }
  }
}
