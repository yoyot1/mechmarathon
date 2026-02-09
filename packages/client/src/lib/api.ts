const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

let token: string | null = null;

export function setToken(t: string | null) {
  token = t;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error: string; field?: string },
  ) {
    super(body.error);
  }
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) ?? {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}
