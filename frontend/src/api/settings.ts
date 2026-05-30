import type { RuntimeSettings } from '../types';
import { resolveApiBase } from '../utils/transport';

export async function updateSettings(
  partial: Partial<RuntimeSettings>,
): Promise<RuntimeSettings> {
  const response = await fetch(`${resolveApiBase()}/api/settings`, {
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
