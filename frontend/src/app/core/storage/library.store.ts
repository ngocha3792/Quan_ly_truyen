import { Injectable, signal } from '@angular/core';

const STORAGE_KEY = 'truyenhub.library.v1';

@Injectable({ providedIn: 'root' })
export class LibraryStore {
  private readonly idsState = signal<ReadonlySet<string>>(this.restore());
  readonly ids = this.idsState.asReadonly();

  has(storyId: string): boolean {
    return this.idsState().has(storyId);
  }

  toggle(storyId: string): boolean {
    const next = new Set(this.idsState());
    const added = !next.has(storyId);
    if (added) next.add(storyId);
    else next.delete(storyId);
    this.idsState.set(next);
    this.persist(next);
    return added;
  }

  private restore(): ReadonlySet<string> {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      const values: string[] = Array.isArray(parsed)
        ? parsed.filter((value: unknown): value is string => typeof value === 'string')
        : [];
      return new Set<string>(values);
    } catch {
      return new Set();
    }
  }

  private persist(ids: ReadonlySet<string>): void {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
  }
}
