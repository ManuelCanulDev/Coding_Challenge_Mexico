export function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return true;
  const host = window.location.hostname;
  return host === 'localhost' || host === '127.0.0.1';
}

export function resolveApiBase(): string {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  return isLocalDevHost() ? 'http://localhost:3001' : '';
}

export function resolveWsUrl(): string {
  if (import.meta.env.VITE_WS_URL) {
    return import.meta.env.VITE_WS_URL;
  }
  if (typeof window === 'undefined') {
    return 'ws://localhost:3001/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (isLocalDevHost()) {
    const port = import.meta.env.VITE_BACKEND_PORT ?? '3001';
    return `${protocol}//${window.location.hostname}:${port}/ws`;
  }
  return `${protocol}//${window.location.host}/ws`;
}
