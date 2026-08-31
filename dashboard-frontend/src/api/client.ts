export const API_BASE = import.meta.env.VITE_API_URL || '';

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

  if (response.status === 401) {
    if (!window.location.pathname.startsWith('/login')) {
      window.location.href = '/login';
    }
    throw new Error('No autenticado');
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data.error || `Error ${response.status}: ${response.statusText}`);
  }

  return data as T;
}
