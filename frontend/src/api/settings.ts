import type { RuntimeSettings } from '../types';

const API_URL =
  import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:3001');

export async function updateSettings(
  partial: Partial<RuntimeSettings>,
): Promise<RuntimeSettings> {
  const response = await fetch(`${API_URL}/api/settings`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(partial),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Error al guardar configuración');
  }

  return response.json() as Promise<RuntimeSettings>;
}
