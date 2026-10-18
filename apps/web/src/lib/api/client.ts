/**
 * Browser-side client for the DevFlow API (proxied same-origin under /api).
 *
 * - Sends and receives JSON.
 * - Adds the X-CSRF-TOKEN header to state-changing requests, fetching the token on demand and
 *   refreshing it once if the server rejects it (tokens are tied to the signed-in user).
 * - Turns error responses (RFC 7807 problem details) into a typed ApiError.
 */

export type ProblemDetails = {
  status?: number;
  title?: string;
  detail?: string;
  code?: string;
  errors?: Record<string, string[]>;
};

export class ApiError extends Error {
  readonly status: number;
  readonly problem: ProblemDetails;

  constructor(status: number, problem: ProblemDetails) {
    super(problem.title ?? `Request failed (HTTP ${status})`);
    this.name = "ApiError";
    this.status = status;
    this.problem = problem;
  }

  /** Field-level validation messages, keyed by camelCase property name. */
  get fieldErrors(): Record<string, string[]> {
    return this.problem.errors ?? {};
  }
}

export function isApiError(error: unknown, status?: number): error is ApiError {
  return error instanceof ApiError && (status === undefined || error.status === status);
}

let csrfToken: Promise<string> | null = null;

function getCsrfToken(): Promise<string> {
  csrfToken ??= fetch("/api/v1/auth/csrf", { cache: "no-store", credentials: "same-origin" })
    .then(async (response) => {
      if (!response.ok) throw new ApiError(response.status, { title: "Could not reach the API." });
      return ((await response.json()) as { token: string }).token;
    })
    .catch((error) => {
      csrfToken = null;
      throw error;
    });
  return csrfToken;
}

/** Call after sign-in, sign-up or sign-out: the old token belongs to the previous identity. */
export function resetCsrfToken() {
  csrfToken = null;
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
};

async function send(path: string, { method = "GET", body, signal }: RequestOptions) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (method !== "GET") headers["X-CSRF-TOKEN"] = await getCsrfToken();

  return fetch(path, {
    method,
    signal,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
    cache: "no-store",
  });
}

async function readProblem(response: Response): Promise<ProblemDetails> {
  try {
    return (await response.json()) as ProblemDetails;
  } catch {
    return { status: response.status, title: response.status >= 500 ? "The server could not complete the request." : undefined };
  }
}

export async function api<T = void>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await send(path, options);
    if (response.status === 400 && options.method && options.method !== "GET") {
      const problem = await readProblem(response.clone());
      if (problem.code === "csrf_invalid") {
        resetCsrfToken();
        response = await send(path, options);
      }
    }
  } catch (error) {
    if (error instanceof ApiError || (error instanceof DOMException && error.name === "AbortError")) throw error;
    throw new ApiError(0, { title: "Could not reach the server. Check your connection and try again." });
  }

  if (!response.ok) {
    throw new ApiError(response.status, await readProblem(response));
  }
  if (response.status === 204 || response.status === 202) {
    return undefined as T;
  }
  const type = response.headers.get("content-type") ?? "";
  return (type.includes("json") ? await response.json() : undefined) as T;
}

/** Builds a query string, skipping empty values. */
export function query(params: Record<string, string | number | boolean | null | undefined>) {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}
