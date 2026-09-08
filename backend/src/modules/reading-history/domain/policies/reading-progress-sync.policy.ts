export type ReadingProgressSyncDecision =
  | { readonly kind: 'accept'; readonly nextRevision: number }
  | { readonly kind: 'duplicate' }
  | {
      readonly kind: 'conflict';
      readonly expectedRevision: number;
      readonly actualRevision: number;
    };

export function decideReadingProgressSync(options: {
  readonly storyId: string;
  readonly baseRevision: number;
  readonly actualRevision: number;
  readonly processedStoryId: string | null;
}): ReadingProgressSyncDecision {
  if (options.processedStoryId === options.storyId) {
    return { kind: 'duplicate' };
  }
  if (
    options.processedStoryId !== null ||
    options.baseRevision !== options.actualRevision
  ) {
    return {
      kind: 'conflict',
      expectedRevision: options.baseRevision,
      actualRevision: options.actualRevision,
    };
  }
  return { kind: 'accept', nextRevision: options.actualRevision + 1 };
}
