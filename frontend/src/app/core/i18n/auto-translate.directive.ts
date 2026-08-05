import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import {
  AfterViewInit,
  DestroyRef,
  Directive,
  ElementRef,
  PLATFORM_ID,
  effect,
  inject,
} from '@angular/core';
import { I18nService } from './i18n.service';

interface TextSnapshot {
  source: string;
  rendered: string;
}

@Directive({
  selector: '[appAutoTranslate]',
  standalone: true,
})
export class AutoTranslateDirective implements AfterViewInit {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly destroyRef = inject(DestroyRef);
  private readonly i18n = inject(I18nService);
  private readonly textSnapshots = new WeakMap<Text, TextSnapshot>();
  private readonly attributeSnapshots = new WeakMap<Element, Map<string, TextSnapshot>>();
  private observer?: MutationObserver;
  private translating = false;

  constructor() {
    effect(() => {
      this.i18n.language();
      queueMicrotask(() => this.translateTree());
    });
  }

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.translateTree();
    this.observer = new MutationObserver(() => this.translateTree());
    this.observer.observe(this.host.nativeElement, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['placeholder', 'aria-label', 'title'],
    });
    this.destroyRef.onDestroy(() => this.observer?.disconnect());
  }

  private translateTree(): void {
    if (!isPlatformBrowser(this.platformId) || this.translating) return;
    this.translating = true;
    try {
      const root = this.host.nativeElement;
      const walker = this.document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
      let node = walker.nextNode();
      while (node) {
        const textNode = node as Text;
        const parent = textNode.parentElement;
        if (parent && !['SCRIPT', 'STYLE', 'TEXTAREA'].includes(parent.tagName)) {
          this.translateTextNode(textNode);
        }
        node = walker.nextNode();
      }

      root.querySelectorAll('[placeholder], [aria-label], [title]').forEach((element) => {
        this.translateAttributes(element);
      });
    } finally {
      this.translating = false;
    }
  }

  private translateTextNode(node: Text): void {
    const current = node.nodeValue ?? '';
    let snapshot = this.textSnapshots.get(node);
    if (!snapshot || current !== snapshot.rendered) {
      snapshot = { source: current, rendered: current };
    }

    const trimmed = snapshot.source.trim();
    if (!trimmed) return;
    const translated = this.i18n.translate(trimmed);
    const rendered = snapshot.source.replace(trimmed, translated);
    if (current !== rendered) node.nodeValue = rendered;
    this.textSnapshots.set(node, { source: snapshot.source, rendered });
  }

  private translateAttributes(element: Element): void {
    const names = ['placeholder', 'aria-label', 'title'];
    const snapshots = this.attributeSnapshots.get(element) ?? new Map<string, TextSnapshot>();

    for (const name of names) {
      if (!element.hasAttribute(name)) continue;
      const current = element.getAttribute(name) ?? '';
      let snapshot = snapshots.get(name);
      if (!snapshot || current !== snapshot.rendered) {
        snapshot = { source: current, rendered: current };
      }
      const rendered = this.i18n.translate(snapshot.source);
      if (current !== rendered) element.setAttribute(name, rendered);
      snapshots.set(name, { source: snapshot.source, rendered });
    }

    this.attributeSnapshots.set(element, snapshots);
  }
}
