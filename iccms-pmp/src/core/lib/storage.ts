/**
 * Namespaced browser storage.
 *
 * Every key is prefixed with `siteConfig.storageNamespace` so the rebuilt app cannot read or collide
 * with the legacy app's keys on the same origin during the transition. A bare
 * `localStorage.setItem("access_token", …)` fails `pnpm lint` (`no-restricted-globals` style — it is
 * caught by review and by this module being the only importer of the pattern).
 *
 * The legacy app leaked state across logins because logout cleared only the token
 * (`docs/audit/auth.md`, "What logout does not clear"). `wipeNamespace()` exists so logout can clear
 * everything this app owns in one call.
 */

import { siteConfig } from "@/config";

const prefix = `${siteConfig.storageNamespace}:`;

export function namespacedKey(key: string): string {
  return `${prefix}${key}`;
}

/** Keys the app owns. Anything not created through this module is not ours to clear. */
function ownKeys(storage: Storage): string[] {
  const keys: string[] = [];
  for (let i = 0; i < storage.length; i += 1) {
    const key = storage.key(i);
    if (key !== null && key.startsWith(prefix)) keys.push(key);
  }
  return keys;
}

function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k) => map.get(k) ?? null,
    key: (i) => [...map.keys()][i] ?? null,
    removeItem: (k) => void map.delete(k),
    setItem: (k, v) => void map.set(k, v),
  } as Storage;
}

/** `localStorage` is absent or throws in SSR/jsdom-without-storage; fall back to memory. */
const local: Storage = (() => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.getItem(namespacedKey("probe"));
      return localStorage;
    }
  } catch {
    /* private mode or blocked cookies */
  }
  return memoryStorage();
})();

export const storage = {
  get(key: string): string | null {
    try {
      return local.getItem(namespacedKey(key));
    } catch {
      return null;
    }
  },

  set(key: string, value: string): void {
    try {
      local.setItem(namespacedKey(key), value);
    } catch {
      /* quota exceeded — a lost preference is not worth crashing the app */
    }
  },

  remove(key: string): void {
    try {
      local.removeItem(namespacedKey(key));
    } catch {
      /* ignore */
    }
  },

  getJson<T>(
    key: string,
    schema: { safeParse: (v: unknown) => { success: boolean; data?: T } },
  ): T | null {
    const raw = storage.get(key);
    if (raw === null) return null;
    try {
      const parsed = schema.safeParse(JSON.parse(raw));
      return parsed.success && parsed.data !== undefined ? parsed.data : null;
    } catch {
      return null;
    }
  },

  setJson(key: string, value: unknown): void {
    try {
      storage.set(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  },

  /**
   * Delete every key this app owns. Used by logout, together with `queryClient.clear()` and the
   * IndexedDB purge — the three together are what the legacy app never did.
   */
  wipeNamespace(): void {
    try {
      for (const key of ownKeys(local)) local.removeItem(key);
    } catch {
      /* ignore */
    }
  },
};

/** Storage keys, in one place so a typo is a type error rather than a silent reset. */
export const STORAGE_KEYS = {
  accessToken: "auth.access-token",
  theme: "ui.theme",
  sidebarCollapsed: "ui.sidebar-collapsed",
} as const;

export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];
