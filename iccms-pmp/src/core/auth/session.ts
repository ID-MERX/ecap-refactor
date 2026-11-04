/**
 * The access token, and nothing else.
 *
 * The legacy app stored `localStorage["ecap.access_token"]` behind a module-level memo that was never
 * invalidated (`legacy:src/lib/auth.ts:1-41`), so a token refreshed by `EtlInvalidator` was written to
 * storage but the memo kept returning the old one to other callers (`docs/audit/auth.md` line 444).
 * Here there is exactly one copy plus a subscriber list, so every client sees the same token.
 */

import { storage, STORAGE_KEYS } from "@/core/lib/storage";

type Listener = (token: string | null) => void;

let current: string | null | undefined;
const listeners = new Set<Listener>();

export function getToken(): string | null {
  if (current === undefined) current = storage.get(STORAGE_KEYS.accessToken);
  return current;
}

function notify(): void {
  for (const listener of listeners) listener(current ?? null);
}

export function setToken(token: string | null, options: { persist?: boolean } = {}): void {
  current = token;
  if (options.persist ?? true) {
    if (token === null) storage.remove(STORAGE_KEYS.accessToken);
    else storage.set(STORAGE_KEYS.accessToken, token);
  }
  notify();
}

export function subscribeToToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Test seam: forget the memoised value so the next read hits storage. */
export function resetTokenCache(): void {
  current = undefined;
}
