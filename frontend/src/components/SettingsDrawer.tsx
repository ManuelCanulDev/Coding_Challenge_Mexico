import { useEffect, useState, type ReactNode } from 'react';
import type { RuntimeSettings } from '../types';
import { updateSettings } from '../api/settings';

interface SettingsDrawerProps {
  open: boolean;
  settings: RuntimeSettings;
  onClose: () => void;
  onSaved: (settings: RuntimeSettings) => void;
}

type FormState = RuntimeSettings;

export function SettingsDrawer({ open, settings, onClose, onSaved }: SettingsDrawerProps) {
  const [form, setForm] = useState<FormState>(settings);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(settings);
      setError(null);
      setSaved(false);
    }
  }, [open, settings]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const setField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateSettings(form);
      onSaved(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden={!open}
      />

      <aside
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-white/10 bg-surface-900 shadow-2xl transition-transform duration-300 ease-out ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
        aria-hidden={!open}
      >
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
          <div>
            <h2 className="text-lg font-semibold text-white">Configuración</h2>
            <p className="text-sm text-gray-500">Ajustes en tiempo real · SQLite</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-gray-400 transition hover:border-white/20 hover:text-white"
          >
            Cerrar
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            <Section title="Modo de operación">
              <ToggleField
                label="Modo demo"
                hint="Activa offsets artificiales de spread para demos"
                checked={form.demoMode}
                onChange={(value) => setField('demoMode', value)}
              />
              <ToggleField
                label="Auto-ejecutar trades"
                hint="Ejecuta automáticamente la mejor oportunidad válida"
                checked={form.autoExecute}
                onChange={(value) => setField('autoExecute', value)}
              />
            </Section>

            <Section title="Mercado">
              <NumberField
                label="Intervalo de polling (ms)"
                value={form.pollIntervalMs}
                min={500}
                max={30000}
                step={100}
                onChange={(value) => setField('pollIntervalMs', value)}
              />
            </Section>

            <Section title="Motor de arbitraje">
              <NumberField
                label="Profit neto mínimo (%)"
                value={form.minNetProfitPct}
                min={0}
                max={10}
                step={0.01}
                onChange={(value) => setField('minNetProfitPct', value)}
              />
              <NumberField
                label="Volumen mínimo (BTC)"
                value={form.minVolumeBtc}
                min={0.0001}
                max={10}
                step={0.0001}
                onChange={(value) => setField('minVolumeBtc', value)}
              />
              <NumberField
                label="Latencia máxima combinada (ms)"
                value={form.maxCombinedLatencyMs}
                min={500}
                max={10000}
                step={100}
                onChange={(value) => setField('maxCombinedLatencyMs', value)}
              />
            </Section>

            <Section title="Circuit breaker">
              <NumberField
                label="Trades negativos consecutivos"
                value={form.circuitBreakerThreshold}
                min={1}
                max={20}
                step={1}
                onChange={(value) => setField('circuitBreakerThreshold', value)}
              />
              <NumberField
                label="Cooldown (ms)"
                value={form.circuitBreakerCooldownMs}
                min={5000}
                max={600000}
                step={1000}
                onChange={(value) => setField('circuitBreakerCooldownMs', value)}
              />
            </Section>
          </div>
        </div>

        <div className="border-t border-white/10 px-6 py-4">
          {error && (
            <p className="mb-3 rounded-lg border border-accent-red/30 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
              {error}
            </p>
          )}
          {saved && (
            <p className="mb-3 rounded-lg border border-accent-green/30 bg-accent-green/10 px-3 py-2 text-sm text-accent-green">
              Configuración guardada y aplicada
            </p>
          )}
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="w-full rounded-xl bg-brand-500 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
        </div>
      </aside>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-gray-500">{title}</h3>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function ToggleField({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-white/[0.06] bg-surface-800/80 px-4 py-3">
      <div>
        <p className="text-sm font-medium text-white">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{hint}</p>
      </div>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-1 h-4 w-4 rounded border-gray-600 bg-surface-700 accent-brand-500"
      />
    </label>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block rounded-xl border border-white/[0.06] bg-surface-800/80 px-4 py-3">
      <span className="text-sm font-medium text-white">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        className="mono mt-2 w-full rounded-lg border border-white/10 bg-surface-900 px-3 py-2 text-sm text-white outline-none focus:border-brand-500/50"
      />
    </label>
  );
}
