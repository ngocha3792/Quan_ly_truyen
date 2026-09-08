import type {
  OfflineChapterBundle,
  OfflineChapterNavigationItem,
  OfflinePackageEntry,
} from './offline.models';
import {
  isStoredPackageReadable,
  requestResult,
  transactionComplete,
  withoutScope,
} from './offline-db.internal';
import type { StoredChapter, StoredMedia, StoredPackage } from './offline-db.internal';

export async function readOfflinePackageEntry(
  database: IDBDatabase,
  scopeKey: string,
  packageId: string,
): Promise<OfflinePackageEntry | null> {
  const packageRecord = await readStoredPackage(database, scopeKey, packageId);
  if (!packageRecord || !isStoredPackageReadable(packageRecord)) return null;
  const chapters = await readPackageChapters(database, scopeKey, packageId);
  const first = chapters.sort((left, right) => left.number - right.number)[0];
  return first ? { storySlug: first.story.slug, chapterNumber: first.number } : null;
}

export async function readOfflineChapterBundle(
  database: IDBDatabase,
  scopeKey: string,
  storySlug: string,
  chapterNumber: number,
): Promise<OfflineChapterBundle | null> {
  const transaction = database.transaction(['packages', 'chapters', 'media'], 'readwrite');
  const done = transactionComplete(transaction);
  const packageStore = transaction.objectStore('packages');
  const chapterStore = transaction.objectStore('chapters');
  const candidates = (await requestResult(
    chapterStore
      .index('by-scope-story-chapter')
      .getAll(IDBKeyRange.only([scopeKey, storySlug, chapterNumber])),
  )) as StoredChapter[];
  const joined = await Promise.all(
    candidates.map(async (chapter) => ({
      chapter,
      package: (await requestResult(packageStore.get([scopeKey, chapter.packageId]))) as
        StoredPackage | undefined,
    })),
  );
  const selected = joined
    .filter(
      (item): item is { chapter: StoredChapter; package: StoredPackage } =>
        Boolean(item.package) && isStoredPackageReadable(item.package!),
    )
    .sort(
      (left, right) =>
        Date.parse(right.package.lastAccessedAt) - Date.parse(left.package.lastAccessedAt),
    )[0];
  if (!selected) {
    await done;
    return null;
  }

  const allChapters = (await requestResult(
    chapterStore
      .index('by-scope-package')
      .getAll(IDBKeyRange.only([scopeKey, selected.package.id])),
  )) as StoredChapter[];
  const media = (await requestResult(
    transaction
      .objectStore('media')
      .index('by-scope-package-chapter')
      .getAll(IDBKeyRange.only([scopeKey, selected.package.id, selected.chapter.chapterId])),
  )) as StoredMedia[];
  const touched = { ...selected.package, lastAccessedAt: new Date().toISOString() };
  await requestResult(packageStore.put(touched));
  await done;

  const ordered = allChapters.sort((left, right) => left.number - right.number);
  const selectedIndex = ordered.findIndex(
    (chapter) => chapter.chapterId === selected.chapter.chapterId,
  );
  return {
    package: withoutScope(touched),
    chapter: withoutScope(selected.chapter),
    media: media.map(withoutScope),
    navigation: {
      previous: toNavigationItem(ordered[selectedIndex - 1]),
      next: toNavigationItem(ordered[selectedIndex + 1]),
    },
  };
}

async function readStoredPackage(database: IDBDatabase, scopeKey: string, packageId: string) {
  return (await requestResult(
    database.transaction('packages', 'readonly').objectStore('packages').get([scopeKey, packageId]),
  )) as StoredPackage | undefined;
}

async function readPackageChapters(database: IDBDatabase, scopeKey: string, packageId: string) {
  return (await requestResult(
    database
      .transaction('chapters', 'readonly')
      .objectStore('chapters')
      .index('by-scope-package')
      .getAll(IDBKeyRange.only([scopeKey, packageId])),
  )) as StoredChapter[];
}

function toNavigationItem(chapter: StoredChapter | undefined): OfflineChapterNavigationItem | null {
  return chapter
    ? { number: chapter.number, title: chapter.title, storySlug: chapter.story.slug }
    : null;
}
