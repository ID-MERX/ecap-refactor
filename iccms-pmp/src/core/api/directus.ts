/** Authenticated Directus REST client. It shares core/api's token, timeout, error and auth-failure handling. */

import { env } from "@/config";

import { request } from "./http";

export type DirectusOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  query?: Record<string, string | number | undefined>;
  body?: unknown;
  signal?: AbortSignal;
};

export function directusRequest<T = unknown>(options: DirectusOptions): Promise<T> {
  const path = `${env.directusUrl}/${options.path.replace(/^\/+/, "")}`;
  return request<T>({
    method: options.method,
    path,
    query: options.query,
    body: options.body,
    signal: options.signal,
  });
}
