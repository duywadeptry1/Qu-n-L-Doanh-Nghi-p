import type { AuthUser, LoginResponse } from '../types/api';

const BASE_ORIGIN = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');
const API_PREFIX = `${BASE_ORIGIN}/api/v1`;

const ACCESS_KEY = 'viendong_access_token';
const REFRESH_KEY = 'viendong_refresh_token';
const USER_KEY = 'viendong_auth_user';

export class ApiError extends Error {
  status: number;
  code?: string;
  payload: Record<string, unknown>;

  constructor(status: number, message: string, payload: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.code = typeof payload.code === 'string' ? payload.code : undefined;
    this.payload = payload;
  }
}

export function getStoredAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function saveSession(data: LoginResponse): void {
  localStorage.setItem(ACCESS_KEY, data.accessToken);
  localStorage.setItem(REFRESH_KEY, data.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

let refreshPromise: Promise<string | null> | null = null;

async function tryRefreshAccessToken(): Promise<string | null> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return null;

  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const res = await fetch(`${API_PREFIX}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken })
        });
        if (!res.ok) {
          clearSession();
          return null;
        }
        const data = (await res.json()) as LoginResponse;
        saveSession(data);
        return data.accessToken;
      } catch {
        clearSession();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }

  return refreshPromise;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  skipAuth?: boolean;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, skipAuth = false } = options;

  const exec = async (token: string | null) => {
    const headers: Record<string, string> = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (!skipAuth && token) headers.Authorization = `Bearer ${token}`;

    return fetch(`${API_PREFIX}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined
    });
  };

  let res = await exec(getStoredAccessToken());

  // Automatically rotate refresh token once on 401
  if (res.status === 401 && !skipAuth && !path.startsWith('/auth/')) {
    const freshToken = await tryRefreshAccessToken();
    if (freshToken) {
      res = await exec(freshToken);
    }
  }

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message =
      typeof json.error === 'string'
        ? json.error
        : `Yêu cầu thất bại (HTTP ${res.status})`;
    throw new ApiError(res.status, message, json);
  }

  return json as T;
}

export async function downloadAuthenticatedCsv(path: string, filename: string): Promise<void> {
  const token = getStoredAccessToken();
  const res = await fetch(`${API_PREFIX}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!res.ok) {
    throw new ApiError(res.status, 'Không thể xuất file báo cáo');
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
