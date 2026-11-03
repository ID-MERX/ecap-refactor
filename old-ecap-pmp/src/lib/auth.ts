const TOKEN_KEY = "ecap.access_token";

/**
 * In-memory cache to avoid synchronous localStorage hits in render loops (e.g. getFileUrl).
 * Initialized to undefined to distinguish between "not yet checked" and "checked but null".
 */
let cachedToken: string | null | undefined = undefined;

export const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  // Use cache if available (including cached null)
  if (cachedToken !== undefined) {
    return cachedToken;
  }

  // Populate cache from localStorage
  const token = window.localStorage.getItem(TOKEN_KEY);
  cachedToken = token;
  return token;
};

export const setStoredToken = (token: string) => {
  if (typeof window === "undefined") {
    return;
  }

  cachedToken = token;
  window.localStorage.setItem(TOKEN_KEY, token);
};

export const clearStoredToken = () => {
  if (typeof window === "undefined") {
    return;
  }

  cachedToken = null;
  window.localStorage.removeItem(TOKEN_KEY);
};
