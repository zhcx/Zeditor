import type { WysiwygBlockKind } from './blocks.ts';

export interface BlockSourceDraftLocation {
  index: number;
  baseSource: string;
  kind: WysiwygBlockKind;
  blockCount: number;
  previousSource: string | null;
  nextSource: string | null;
}

/** Find the original block even when an external update changed its source text. */
export function resolveBlockSourceDraftIndex(
  location: BlockSourceDraftLocation,
  blocks: ReadonlyArray<Pick<{ kind: WysiwygBlockKind; source: string }, 'kind' | 'source'>>,
): number {
  if (blocks[location.index]?.source === location.baseSource) return location.index;
  const exact = blocks.findIndex(block => block.source === location.baseSource);
  if (exact >= 0) return exact;
  const { index, kind, blockCount, previousSource, nextSource } = location;
  if (blocks.length !== blockCount || blocks[index]?.kind !== kind) return -1;
  if ((index === 0 || blocks[index - 1].source === previousSource)
    && (index === blocks.length - 1 || blocks[index + 1].source === nextSource)) return index;
  return -1;
}

/** Resolve an in-place source draft without silently replacing a newer external edit. */export function resolveBlockSourceDraft(
  baseSource: string,
  currentSource: string,
  draftSource: string,
  confirmOverwrite: () => boolean,
): string {
  if (draftSource === baseSource) return currentSource;
  if (currentSource === baseSource) return draftSource;
  return confirmOverwrite() ? draftSource : currentSource;
}
