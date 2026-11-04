/**
 * The signed-in user: Directus login, the `/users/me` profile, and logout.
 *
 * Kept separate from the React `AuthProvider` so the query hooks stay testable and so the token
 * plumbing is independent of the component tree.
 */

import { z } from "zod";

import { env } from "@/config";
import { ApiError } from "@/core/api/errors";
import { request } from "@/core/api/http";

/**
 * The profile fields the app reads. `/users/me` is asked for exactly these and nothing else.
 *
 * `description`, `title` and `location` are the free-text fields `deriveAccess` interprets
 * (`docs/AUDIT.md` §4.4) — they are fetched because the access rules need them, not for display.
 */
export const meSchema = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  location: z.string().nullable().optional(),
  avatar: z.string().nullable().optional(),
  password_change_required: z.boolean().nullable().optional(),
  role: z
    .union([z.string(), z.object({ id: z.string(), name: z.string() })])
    .nullable()
    .optional(),
});

export type Me = z.infer<typeof meSchema>;

/** Directus wraps single objects in `{ data: … }`. The legacy app handled both shapes. */
const envelope = z.union([z.object({ data: z.unknown() }), z.unknown()]);

const ME_FIELDS = [
  "id",
  "email",
  "first_name",
  "last_name",
  "description",
  "title",
  "location",
  "avatar",
  "password_change_required",
  "role.id",
  "role.name",
].join(",");

export function displayName(me: Me): string {
  const name = [me.first_name, me.last_name].filter(Boolean).join(" ").trim();
  return name || me.email;
}

export function roleName(me: Me): string | null {
  if (typeof me.role === "string") return me.role;
  return me.role?.name ?? null;
}

/**
 * `POST /auth/login` on Directus.
 *
 * The email is sent exactly as typed — the legacy app did the same and some accounts depend on the
 * exact string (`docs/audit/auth.md`, login endpoint notes). The response carries
 * `access_token` plus a refresh token that is deliberately **not** stored: the backend has no refresh
 * endpoint (backend ask #6), so a 401 means "sign in again".
 */
export async function login(email: string, password: string): Promise<string> {
  const bodySchema = z.object({
    data: z.object({ access_token: z.string() }).optional(),
    access_token: z.string().optional(),
    errors: z.array(z.object({ message: z.string() })).optional(),
  });

  const response = await fetch(`${env.directusUrl}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const payload = bodySchema.safeParse(await safeJson(response));

  if (!response.ok) {
    // Directus reports a bad email/password as 401 with `errors[0].message`.
    const message = payload.success ? payload.data.errors?.[0]?.message : undefined;
    throw new ApiError(message ?? "Sign-in failed. Check your email and password.", "auth", {
      status: response.status,
      serverMessage: message,
    });
  }

  if (!payload.success) {
    throw new ApiError("Sign-in returned an unexpected response", "validation");
  }

  const token = payload.data.data?.access_token ?? payload.data.access_token;
  if (!token) throw new ApiError("No access token returned", "auth");
  return token;
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

/**
 * `GET /users/me` on Directus, through the shared HTTP client so it inherits the timeout, the token
 * header and the 401 handling.
 *
 * The shared client is pointed at the API base, so this call passes an absolute URL via `path` —
 * `new URL(absolute, base)` keeps the absolute one.
 */
export async function fetchMe(): Promise<Me> {
  const raw = await request({
    path: `${env.directusUrl}/users/me`,
    query: { fields: ME_FIELDS },
    schema: envelope,
  });
  const unwrapped =
    raw && typeof raw === "object" && "data" in raw ? (raw as { data: unknown }).data : raw;

  const parsed = meSchema.safeParse(unwrapped);
  if (!parsed.success) {
    throw new ApiError("Your profile could not be read", "validation", {
      detail: parsed.error.issues,
    });
  }
  return parsed.data;
}

/**
 * Best-effort session teardown on the server. Never blocks sign-out: if Directus is unreachable the
 * local session is still discarded, which is the behaviour the legacy app lacked.
 */
export async function logoutRemote(): Promise<void> {
  try {
    await fetch(`${env.directusUrl}/auth/logout`, { method: "POST" });
  } catch {
    /* ignore */
  }
}
