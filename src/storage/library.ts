import { readStorage, writeStorage } from "./localStorage";

export interface LibraryItem {
  addonUrl: string;
  type: string;
  contentId: string;
  // Denormalized display context, saved alongside the flags so the Library
  // screen can render without a network round-trip — same pattern as
  // PlaybackProgress.
  title: string;
  poster?: string;
  favorited: boolean;
  watched: boolean;
  addedAt: number;
  updatedAt: number;
}

export interface LibraryContentRef {
  addonUrl: string;
  type: string;
  contentId: string;
  title: string;
  poster?: string;
}

const STORAGE_KEY = "library";

function libraryKey(addonUrl: string, type: string, contentId: string): string {
  return `${addonUrl}::${type}::${contentId}`;
}

function readAll(): Record<string, LibraryItem> {
  return readStorage<Record<string, LibraryItem>>(STORAGE_KEY) ?? {};
}

export function getLibraryItem(addonUrl: string, type: string, contentId: string): LibraryItem | undefined {
  return readAll()[libraryKey(addonUrl, type, contentId)];
}

export function getAllLibraryItems(): LibraryItem[] {
  return Object.values(readAll()).sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Upserts favorited/watched for a title, deleting the entry once neither flag is set — nothing left worth keeping around. */
function updateLibraryItem(ref: LibraryContentRef, patch: Partial<Pick<LibraryItem, "favorited" | "watched">>): LibraryItem {
  const all = readAll();
  const key = libraryKey(ref.addonUrl, ref.type, ref.contentId);
  const existing = all[key];

  const next: LibraryItem = {
    addonUrl: ref.addonUrl,
    type: ref.type,
    contentId: ref.contentId,
    title: ref.title,
    poster: ref.poster,
    favorited: existing?.favorited ?? false,
    watched: existing?.watched ?? false,
    addedAt: existing?.addedAt ?? Date.now(),
    updatedAt: Date.now(),
    ...patch,
  };

  if (!next.favorited && !next.watched) {
    delete all[key];
  } else {
    all[key] = next;
  }
  writeStorage(STORAGE_KEY, all);
  return next;
}

export function setFavorited(ref: LibraryContentRef, favorited: boolean): LibraryItem {
  return updateLibraryItem(ref, { favorited });
}

export function setWatched(ref: LibraryContentRef, watched: boolean): LibraryItem {
  return updateLibraryItem(ref, { watched });
}
