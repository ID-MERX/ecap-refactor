/**
 * Superset Embedded Dashboard Utilities
 *
 * Guest tokens are issued by the PMP backend (POST /superset/guest-token).
 * The backend holds the Superset service-account credentials and builds the
 * row-level-security rules from the logged-in user's scope, so no Superset
 * credentials are ever shipped to the browser.
 */
import { getStoredToken } from "@/lib/auth";
import { getBackendBaseUrl } from "@/lib/env";

const SUPERSET_DOMAIN = import.meta.env.VITE_SUPERSET_DOMAIN as string;

/**
 * Fetch a guest token for one dashboard.
 * Pass this to the `fetchGuestToken` callback of embedDashboard().
 *
 * The second argument is accepted for backwards compatibility and ignored:
 * the backend decides who the user is from their session.
 */
export async function fetchGuestToken(
  dashboardId: string,
  _user?: unknown,
): Promise<string> {
  const token = getStoredToken();
  if (!token) throw new Error("Not authenticated.");

  const response = await fetch(`${getBackendBaseUrl()}/superset/guest-token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ dashboardId }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.token) {
    throw new Error(data?.message ?? `Guest token request failed (${response.status})`);
  }
  return data.token as string;
}

export { SUPERSET_DOMAIN };
