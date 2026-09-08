export const API_BASE = import.meta.env.VITE_API_URL || '';

export class ApiError extends Error {
  status?: number;
  data?: any;
  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

export async function fetchApi<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers = new Headers(options.headers || {});
  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Include HTTP-only cookies
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401) {
    const isPublicRoute =
      window.location.pathname.startsWith('/login') ||
      window.location.pathname.startsWith('/r/');

    if (!isPublicRoute && endpoint !== '/auth/me') {
      window.location.href = '/login';
    }
    throw new ApiError(data.error || 'No autenticado', 401, data);
  }

  if (!response.ok) {
    throw new ApiError(data.error || `Error ${response.status}: ${response.statusText}`, response.status, data);
  }

  return data as T;
}
