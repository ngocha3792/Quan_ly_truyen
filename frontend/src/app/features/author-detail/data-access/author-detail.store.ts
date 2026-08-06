
import {
    computed,
    inject,
    Injectable,
    signal,
} from '@angular/core';

import { AuthorDetailView } from '../domain/author-detail.models';
import { AuthorDetailRepository } from '../domain/author-detail.repository';

@Injectable()
export class AuthorDetailStore {
    private readonly repository = inject(AuthorDetailRepository);

    private readonly viewState =
        signal<AuthorDetailView | null>(null);

    readonly view = this.viewState.asReadonly();

    readonly isFollowing = signal(false);

    readonly followerLabel = computed(() => {
        const view = this.viewState();

        if (!view) {
            return '';
        }

        return this.isFollowing()
            ? `${view.statistics.followers} · Đang theo dõi`
            : `${view.statistics.followers} người theo dõi`;
    });

    load(slug: string): void {
        this.viewState.set(
            this.repository.getBySlug(slug),
        );
    }

    toggleFollow(): void {
        this.isFollowing.update(
            (current) => !current,
        );
    }
}