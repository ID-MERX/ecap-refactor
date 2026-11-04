/**
 * Token and storage behaviour.
 *
 * The legacy app's bug (`docs/audit/auth.md` line 444) was a module-level memo that was never
 * invalidated: `EtlInvalidator` refreshed the token in storage, but every other caller kept reading
 * the stale one out of the closure. These tests pin the fixed behaviour.
 */

import { beforeEach, describe, expect, it } from "vitest";

import { getToken, resetTokenCache, setToken, subscribeToToken } from "../session";
import { storage, STORAGE_KEYS, namespacedKey } from "@/core/lib/storage";

beforeEach(() => {
  storage.wipeNamespace();
  resetTokenCache();
});

describe("session token", () => {
  it("persists across a cache reset", () => {
    setToken("token-a");
    resetTokenCache();
    expect(getToken()).toBe("token-a");
  });

  it("is memoised, not re-read from storage on every call", () => {
    setToken("token-a");
    // Simulate another tab overwriting storage behind our back.
    localStorage.setItem(namespacedKey(STORAGE_KEYS.accessToken), "token-b");
    expect(getToken()).toBe("token-a");
  });

  it("sees a refreshed token immediately (the legacy bug)", () => {
    // Every client reads through `getToken`, which returns the new value after `setToken`.
    setToken("token-a");
    setToken("token-b");
    expect(getToken()).toBe("token-b");
  });

  it("notifies subscribers on change", () => {
    const seen: Array<string | null> = [];
    const unsubscribe = subscribeToToken((token) => seen.push(token));
    setToken("token-a");
    setToken(null);
    unsubscribe();
    setToken("token-b");
    expect(seen).toEqual(["token-a", null]);
  });

  it("removes the stored token on sign-out", () => {
    setToken("token-a");
    setToken(null);
    expect(localStorage.getItem(namespacedKey(STORAGE_KEYS.accessToken))).toBeNull();
  });
});

describe("storage namespace", () => {
  it("prefixes every key with the app namespace", () => {
    expect(namespacedKey("foo")).toBe("iccms-pmp:foo");
  });

  it("cannot collide with the legacy app's keys", () => {
    localStorage.setItem("ecap.access_token", "legacy-token");
    setToken("new-token");
    expect(localStorage.getItem("ecap.access_token")).toBe("legacy-token");
  });

  it("wipeNamespace removes only its own keys", () => {
    localStorage.setItem("ecap.access_token", "legacy-token");
    localStorage.setItem("unrelated", "keep-me");
    storage.setJson("something", { a: 1 });

    storage.wipeNamespace();

    expect(localStorage.getItem("ecap.access_token")).toBe("legacy-token");
    expect(localStorage.getItem("unrelated")).toBe("keep-me");
    expect(storage.get("something")).toBeNull();
  });
});
