import { clearStoredAuthSession, readStoredAuthSession } from './auth-session';

type ApiFetchOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  buildingId?: string;
  body?: unknown;
};

async function parseResponse(response: Response) {
  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { message: text };
  }
}

export async function appFetch<T>(path: string, options: ApiFetchOptions = {}) {
  const normalizedPath = path.replace(/^\/+/, '');
  const token = readStoredAuthSession()?.token;
  const response = await fetch(`/api/proxy/${normalizedPath}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.buildingId ? { 'x-building-id': options.buildingId } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store'
  });

  const payload = await parseResponse(response);

  if (!response.ok) {
    if (response.status === 401) {
      clearStoredAuthSession();
    }

    const message =
      payload && typeof payload === 'object' && 'message' in payload && typeof payload.message === 'string'
        ? payload.message
        : 'İstek işlenirken bir sorun oluştu.';

    throw new Error(message);
  }

  return payload as T;
}
