import { DOCUMENT } from '@angular/common';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { APP_NAME } from '../config/app-identity.constants';

export interface SeoMetadata {
  readonly title: string;
  readonly description: string;
  readonly canonicalPath: string;
  readonly type: string;
  readonly imageUrl?: string;
  readonly robots?: string;
}

const DEFAULT_ROBOTS = 'index,follow,max-image-preview:large';
const DEFAULT_SOCIAL_IMAGE = '/assets/images/og-preview.webp';

export const SEO_PUBLIC_ORIGIN = new InjectionToken<string | null>('SEO_PUBLIC_ORIGIN', {
  providedIn: 'root',
  factory: () => null,
});

@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly meta = inject(Meta);
  private readonly title = inject(Title);
  private readonly publicOrigin = inject(SEO_PUBLIC_ORIGIN);

  apply(metadata: SeoMetadata): void {
    const canonicalUrl = this.absoluteUrl(metadata.canonicalPath);
    const imageUrl = this.absoluteUrl(metadata.imageUrl ?? DEFAULT_SOCIAL_IMAGE);

    this.title.setTitle(metadata.title);
    this.updateName('description', metadata.description);
    this.updateName('robots', metadata.robots ?? DEFAULT_ROBOTS);
    this.updateProperty('og:site_name', APP_NAME);
    this.updateProperty('og:type', metadata.type);
    this.updateProperty('og:title', metadata.title);
    this.updateProperty('og:description', metadata.description);
    this.updateProperty('og:url', canonicalUrl);
    this.updateProperty('og:image', imageUrl);
    this.updateName('twitter:card', 'summary_large_image');
    this.updateName('twitter:title', metadata.title);
    this.updateName('twitter:description', metadata.description);
    this.updateName('twitter:image', imageUrl);
    this.updateCanonical(canonicalUrl);
  }

  setStructuredData(key: string, data: Readonly<Record<string, unknown>>): void {
    const id = this.structuredDataId(key);
    let script = this.document.getElementById(id) as HTMLScriptElement | null;

    if (!script) {
      script = this.document.createElement('script');
      script.id = id;
      script.type = 'application/ld+json';
      this.document.head.appendChild(script);
    }

    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
  }

  removeStructuredData(key: string): void {
    this.document.getElementById(this.structuredDataId(key))?.remove();
  }

  absoluteUrl(pathOrUrl: string): string {
    const baseUrl = this.publicOrigin ?? this.document.baseURI;

    try {
      return new URL(pathOrUrl, baseUrl).toString();
    } catch {
      return pathOrUrl;
    }
  }

  private updateName(name: string, content: string): void {
    this.meta.updateTag({ name, content }, `name='${name}'`);
  }

  private updateProperty(property: string, content: string): void {
    this.meta.updateTag({ property, content }, `property='${property}'`);
  }

  private updateCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');

    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }

    link.href = url;
  }

  private structuredDataId(key: string): string {
    return `seo-jsonld-${key}`;
  }
}
