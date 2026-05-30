import type { RuntimeSettings } from '../types';
import { resolveApiBase } from '../utils/transport';

export async function updateSettings(
  partial: Partial<RuntimeSettings>,
): Promise<RuntimeSettings> {
  const url = `${resolveApiBase()}/api/settings`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(partial),
    });
  } catch {
    throw new Error('No se pudo conectar con el servidor. Recarga la página e intenta de nuevo.');
  }

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? 'Error al guardar configuración');
  }

  return response.json() as Promise<RuntimeSettings>;
}
