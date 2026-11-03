import { lazy, type ComponentType } from "react";

// Matches the various ways a browser reports that a code-split chunk failed to
// load. This happens after a redeploy: the user still has the old index.html,
// which references old hash-named chunks that no longer exist on the server.
// The dev/preview server then serves index.html (text/html) in their place,
// which is why we also see the "MIME type" variant.
export const isChunkLoadError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return (
    message.includes("Failed to fetch dynamically imported module") ||
    message.includes("Importing a module script failed") ||
    message.includes("error loading dynamically imported module") ||
    message.includes("Loading chunk") ||
    message.includes("ChunkLoadError") ||
    // MIME-type mismatch: the server returned index.html instead of the JS chunk
    (message.includes("module script") && message.includes("MIME type"))
  );
};

// Only force-reload once within this window. If the chunk is genuinely gone
// after a reload (not just stale), we stop trying so the error boundary can
// show a real message instead of reloading forever.
const RELOAD_GUARD_KEY = "ecap_chunk_reload_at";
const RELOAD_GUARD_MS = 10_000;

/**
 * Drop-in replacement for React.lazy that recovers from stale-chunk errors.
 *
 * On a chunk-load failure it forces a single hard reload, which fetches the
 * fresh index.html (and therefore the new chunk names). A sessionStorage guard
 * prevents an infinite reload loop if the chunk is truly missing.
 */
export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const component = await factory();
      // Loaded fine — clear any prior reload marker so a future stale chunk
      // is allowed to trigger a fresh reload.
      window.sessionStorage.removeItem(RELOAD_GUARD_KEY);
      return component;
    } catch (error) {
      if (!isChunkLoadError(error)) throw error;

      const lastReload = Number(
        window.sessionStorage.getItem(RELOAD_GUARD_KEY) || 0,
      );
      if (Date.now() - lastReload > RELOAD_GUARD_MS) {
        window.sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
        window.location.reload();
        // Keep showing the Suspense fallback while the page reloads.
        return new Promise<never>(() => {});
      }

      // Already reloaded recently and the chunk is still unavailable — let the
      // error propagate to the ChunkErrorBoundary.
      throw error;
    }
  });
}
