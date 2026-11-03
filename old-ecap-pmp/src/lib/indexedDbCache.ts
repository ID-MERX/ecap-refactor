type CacheEnvelope<T> = {
  value: T;
  updatedAt: number;
};

const DB_NAME = "ecap_plus_cache_db";
const STORE_NAME = "api_cache";
const DB_VERSION = 1;

const isIndexedDbAvailable = () => {
  return typeof window !== "undefined" && "indexedDB" in window;
};

const openCacheDb = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (!isIndexedDbAvailable()) {
      reject(new Error("IndexedDB is not available in this environment."));
      return;
    }

    const request = window.indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open IndexedDB."));
  });
};

const runIdbRequest = <T>(request: IDBRequest<T>): Promise<T> => {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed."));
  });
};

export const getCacheEntry = async <T>(key: string): Promise<CacheEnvelope<T> | null> => {
  if (!isIndexedDbAvailable()) return null;

  try {
    const db = await openCacheDb();
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const raw = await runIdbRequest<unknown>(store.get(key));
    db.close();

    if (!raw || typeof raw !== "object") return null;
    const entry = raw as CacheEnvelope<T>;
    if (typeof entry.updatedAt !== "number" || !("value" in entry)) return null;
    return entry;
  } catch (error) {
    console.warn("[IndexedDB] Failed to read cache entry:", key, error);
    return null;
  }
};

export const setCacheEntry = async <T>(key: string, value: T): Promise<void> => {
  if (!isIndexedDbAvailable()) return;

  try {
    const db = await openCacheDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    const payload: CacheEnvelope<T> = {
      value,
      updatedAt: Date.now(),
    };

    await runIdbRequest(store.put(payload, key));
    db.close();
  } catch (error) {
    console.warn("[IndexedDB] Failed to write cache entry:", key, error);
  }
};

export const clearAllCacheEntries = async (): Promise<void> => {
  if (!isIndexedDbAvailable()) return;
  try {
    const db = await openCacheDb();
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    await runIdbRequest(store.clear());
    db.close();
  } catch (error) {
    console.warn("[IndexedDB] Failed to clear cache:", error);
  }
};
