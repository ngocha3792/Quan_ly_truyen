
import {
    Injectable,
    signal,
} from '@angular/core';

import { ChapterReaderView } from '../domain/chapter-reader.models';
import { CHAPTER_READER_MOCK } from '../mock/chapter-reader.mock';

@Injectable()
export class ChapterReaderStore {
    private readonly viewState =
        signal<ChapterReaderView | null>(null);

    readonly view = this.viewState.asReadonly();

    readonly fontSize = signal(18);
    readonly lightsOff = signal(false);
    readonly bookmarked = signal(false);

    load(): void {
        this.viewState.set(CHAPTER_READER_MOCK);
    }

    decreaseFontSize(): void {
        this.fontSize.update((current) =>
            Math.max(15, current - 1),
        );
    }

    increaseFontSize(): void {
        this.fontSize.update((current) =>
            Math.min(26, current + 1),
        );
    }

    resetFontSize(): void {
        this.fontSize.set(18);
    }

    toggleLights(): void {
        this.lightsOff.update((current) => !current);
    }

    toggleBookmark(): void {
        this.bookmarked.update((current) => !current);
    }
}