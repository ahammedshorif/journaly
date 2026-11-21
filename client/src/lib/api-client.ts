import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { ApiErrorBody } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: { path: string; message: string }[],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE";

interface RequestOptions {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  signal?: AbortSignal;
}

async function getAccessToken() {
  const supabase = getSupabaseBrowserClient();
  const { data } = await supabase.auth.getSession(); // auto-refreshes an expired token
  return data.session?.access_token ?? null;
}

async function request<T>(method: Method, path: string, opts: RequestOptions = {}): Promise<T> {
  const url = new URL(`${API_URL}${path}`);
  for (const [k, v] of Object.entries(opts.query ?? {})) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }

  const token = await getAccessToken();
  const res = await fetch(url, {
    method,
    signal: opts.signal,
    headers: {
      ...(opts.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (res.status === 204) return undefined as T;

  const json = (await res.json().catch(() => null)) as ({ data: T } & Partial<ApiErrorBody>) | null;

  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined") {
      // Session is gone/invalid — bounce to login.
      window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`;
    }
    throw new ApiError(
      res.status,
      json?.error?.message ?? `Request failed (${res.status})`,
      json?.error?.code,
      json?.error?.details,
    );
  }

  return (json as { data: T }).data;
}

/** Authenticated file download (CSV/PDF exports): fetch → blob → save with the server's filename. */
async function download(path: string, query: RequestOptions["query"] = {}) {
  const url = new URL(`${API_URL}${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const token = await getAccessToken();
  const res = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as Partial<ApiErrorBody> | null;
    throw new ApiError(res.status, json?.error?.message ?? `Download failed (${res.status})`, json?.error?.code);
  }
  const filename = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") ?? "")?.[1] ?? "export";
  const blob = await res.blob();
  const href = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export const api = {
  download,
  get: <T>(path: string, opts?: Omit<RequestOptions, "body">) => request<T>("GET", path, opts),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  patch: <T>(path: string, body?: unknown) => request<T>("PATCH", path, { body }),
  delete: <T = void>(path: string) => request<T>("DELETE", path),
};

export function errorMessage(err: unknown) {
  if (err instanceof ApiError) {
    return err.details?.length ? `${err.message}: ${err.details.map((d) => d.message).join(", ")}` : err.message;
  }
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
