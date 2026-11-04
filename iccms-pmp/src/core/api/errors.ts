/**
 * One error type for every failure the app can produce, so a component never has to guess whether it
 * caught a `TypeError` from `fetch`, a zod issue, or an `ApiError`.
 *
 * The backend answers with `{ status: "fail" | "error", message }` (`backend:index.js` error handler)
 * and uses 401 for every auth problem — there is no refresh token (`docs/AUDIT.md` §4.2, backend ask
 * #6), so a 401 always means "log in again", never "retry".
 */

export type ApiErrorKind =
  | "network" // fetch itself threw: offline, DNS, CORS, aborted
  | "timeout"
  | "auth" // 401 / 403 — the session is gone or the user may not see this
  | "notfound" // 404
  | "validation" // the response did not match its schema
  | "server" // 5xx
  | "client" // any other 4xx
  | "unknown";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | undefined;
  /** The backend's `message` field, when it sent one. */
  readonly serverMessage: string | undefined;
  /** Extra detail for logs only — never rendered. */
  readonly detail: unknown;

  constructor(
    message: string,
    kind: ApiErrorKind,
    options: { status?: number; serverMessage?: string; detail?: unknown; cause?: unknown } = {},
  ) {
    super(message, { cause: options.cause });
    this.name = "ApiError";
    this.kind = kind;
    this.status = options.status;
    this.serverMessage = options.serverMessage;
    this.detail = options.detail;
  }

  /** A 401/403 means the session must be discarded, not retried. */
  get isAuthFailure(): boolean {
    return this.kind === "auth";
  }

  /** Only transient failures are worth retrying. A 4xx never is. */
  get isRetryable(): boolean {
    return this.kind === "network" || this.kind === "timeout" || this.kind === "server";
  }
}

export function kindForStatus(status: number): ApiErrorKind {
  if (status === 401 || status === 403) return "auth";
  if (status === 404) return "notfound";
  if (status >= 500) return "server";
  if (status >= 400) return "client";
  return "unknown";
}

/**
 * A message safe to show a user. The backend's own messages are shown only for 4xx: a 5xx message can
 * leak a stack trace or a SQL fragment, and the legacy app rendered them verbatim.
 */
export function userMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === "network")
      return "Cannot reach the server. Check your connection and try again.";
    if (error.kind === "timeout") return "The server took too long to respond. Try again.";
    if (error.kind === "auth")
      return error.status === 403
        ? "You do not have access to this data."
        : "Your session has expired. Please sign in again.";
    if (error.kind === "validation") return "The server returned data this page could not read.";
    if (error.kind === "server") return "The server had a problem. Try again in a moment.";
    return error.serverMessage ?? "Something went wrong.";
  }
  return "Something went wrong.";
}
