let token: string | null = localStorage.getItem('vv_token');

export function setAuthToken(newToken: string | null) {
  token = newToken;
  if (newToken) {
    localStorage.setItem('vv_token', newToken);
  } else {
    localStorage.removeItem('vv_token');
  }
}

export function getAuthToken(): string | null {
  return token;
}

export async function apiFetch<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  let res = await fetch(endpoint, { ...options, headers });

  // Handle token expiration & automatic refresh
  if (res.status === 401 && endpoint !== '/api/auth/login' && endpoint !== '/api/auth/refresh') {
    try {
      const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
      if (refreshRes.ok) {
        const data = await refreshRes.json();
        setAuthToken(data.accessToken);
        headers.set('Authorization', `Bearer ${data.accessToken}`);
        res = await fetch(endpoint, { ...options, headers });
      } else {
        setAuthToken(null);
        window.dispatchEvent(new Event('auth:unauthorized'));
      }
    } catch {
      setAuthToken(null);
      window.dispatchEvent(new Event('auth:unauthorized'));
    }
  }

  if (!res.ok) {
    let errMessage = 'Request failed';
    try {
      const errJson = await res.json();
      errMessage = errJson.error || errJson.message || errMessage;
    } catch {
      errMessage = await res.text();
    }
    throw new Error(errMessage);
  }

  // Handle file and blob downloads (PDF, Excel, CSV, attachments)
  const contentType = res.headers.get('content-type') || '';
  const contentDisp = res.headers.get('content-disposition') || '';
  if (
    contentDisp.includes('attachment') ||
    contentType.includes('application/pdf') ||
    contentType.includes('spreadsheetml') ||
    contentType.includes('text/csv') ||
    contentType.includes('application/octet-stream')
  ) {
    return (await res.blob()) as unknown as T;
  }

  return res.json();
}
