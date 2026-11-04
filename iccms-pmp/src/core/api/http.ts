/**
 * The one place the app performs HTTP.
 *
 * `CLAUDE.md`: "All HTTP goes through `core/api` clients. No raw `fetch` in modules."
 *
 * Deliberately thin. It does not parse responses into domain types — callers hand a zod schema to
 * `request()` and get a typed value or an `ApiError` with `kind: "validation"`. That keeps every raw
 * API shape out of components.
 */

import type { z } from "zod";

import { env } from "@/config";

import { ApiError, kindForStatus } from "./errors";

const DEFAULT_TIMEOUT_MS = 30_000;

/** Called for any 401/403 so the auth layer can drop the session. Set once, in the provider. */
let onAuthFailure: (() => void) | null = null;

export function setAuthFailureHandler(handler: (() => void) | null): void {
  onAuthFailure = handler;
}

export type RequestOptions<T> = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | boolean | undefined | ReadonlyArray<string>>;
  body?: unknown;
  schema?: z.ZodType<T>;
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Send the bearer token. Off only for the login call. */
  authenticated?: boolean;
};

let tokenProvider: () => string | null = () => null;

export function setTokenProvider(provider: () => string | null): void {
  tokenProvider = provider;
}

function buildUrl(path: string, query: RequestOptions<unknown>["query"]): string {
  const url = new URL(path.replace(/^\/+/, ""), `${env.apiUrl}/`);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value === undefined) continue;
    // Arrays are sent comma-separated: the backend splits `district` on commas
    // (`backend:controllers/householdController.js:12-16`) but does not read repeated params.
    url.searchParams.set(key, Array.isArray(value) ? value.join(",") : String(value));
  }
  return url.toString();
}

async function parseBody(response: Response): Promise<unknown> {
  const type = response.headers.get("content-type") ?? "";
  if (type.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  const text = await response.text();
  return text === "" ? null : text;
}

/** Pull the backend's `{ status, message }` shape without trusting it. */
function serverMessageOf(body: unknown): string | undefined {
  if (body && typeof body === "object" && "message" in body) {
    const message = (body as { message: unknown }).message;
    if (typeof message === "string") return message;
  }
  return undefined;
}

export async function request<T>(options: RequestOptions<T>): Promise<T> {
  const { method = "GET", path, query, body, schema, timeoutMs = DEFAULT_TIMEOUT_MS } = options;
  const authenticated = options.authenticated ?? true;

  const headers = new Headers({ Accept: "application/json" });
  if (body !== undefined) headers.set("Content-Type", "application/json");

  if (authenticated) {
    const token = tokenProvider();
    if (token) headers.set("Authorization", `Bearer ${token}`);
  }

  // A single timeout that also aborts the body read. `AbortSignal.timeout` is not available in
  // jsdom, so wire an explicit controller.
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new DOMException("timeout", "TimeoutError")),
    timeoutMs,
  );
  const onExternalAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", onExternalAbort, { once: true });

  const url = buildUrl(path, query);
  if (env.debugApi) console.warn(`[api] ${method} ${url}`);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = controller.signal.aborted;
    const timedOut =
      aborted && (controller.signal.reason as { name?: string })?.name === "TimeoutError";
    throw new ApiError(
      timedOut ? `Request timed out after ${timeoutMs}ms` : "Network request failed",
      timedOut ? "timeout" : "network",
      { cause: error },
    );
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onExternalAbort);
  }

  const payload = await parseBody(response);

  if (!response.ok) {
    const kind = kindForStatus(response.status);
    if (kind === "auth") onAuthFailure?.();
    throw new ApiError(serverMessageOf(payload) ?? `Request failed with ${response.status}`, kind, {
      status: response.status,
      serverMessage: serverMessageOf(payload),
      detail: payload,
    });
  }

  if (!schema) return payload as T;

  const result = schema.safeParse(payload);
  if (!result.success) {
    throw new ApiError("Response did not match the expected shape", "validation", {
      detail: result.error.issues,
    });
  }
  return result.data;
}
