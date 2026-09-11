const API_BASE = "/api";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...init,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ? `: ${body.detail}` : "";
    } catch {
      // response wasn't JSON; ignore
    }
    throw new ApiError(
      res.status,
      `${init?.method ?? "GET"} ${path} failed (${res.status})${detail}`,
    );
  }
  return res.json() as Promise<T>;
}

async function requestForm<T>(path: string, form: FormData): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, { method: "POST", body: form });
  if (!res.ok) {
    let detail = "";
    try {
      const body = await res.json();
      detail = body?.detail ? `: ${body.detail}` : "";
    } catch {
      // response wasn't JSON; ignore
    }
    throw new ApiError(res.status, `POST ${path} failed (${res.status})${detail}`);
  }
  return res.json() as Promise<T>;
}

export const http = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined }),
  // No Content-Type header here on purpose: the browser must set the
  // multipart boundary itself, which it can only do for a bare FormData body.
  postForm: <T>(path: string, form: FormData) => requestForm<T>(path, form),
};
