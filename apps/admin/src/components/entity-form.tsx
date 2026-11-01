'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { toFormValues, validate, type FormDef } from '@/lib/forms';
import { Button, ErrorBox, cn } from './ui';

/** Generic create / edit form: renders a FormDef, validates with its zod schema, then calls onSubmit. */
export function EntityForm({ def, initial, submitLabel = 'Save', onSubmit, onCancel }: {
  def: FormDef;
  initial?: Record<string, unknown>;
  submitLabel?: string;
  onSubmit: (data: any) => Promise<void>;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<Record<string, string | boolean>>(() => toFormValues(def.fields, initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);
    const r = validate(def.schema, values);
    if (!r.ok) { setErrors(r.errors); return; }
    setErrors({});
    setBusy(true);
    try {
      await onSubmit(r.data);
    } catch (err) {
      const details = err instanceof ApiError && Array.isArray(err.details) ? (err.details as { path: string; message: string }[]) : [];
      if (details.length) setErrors(Object.fromEntries(details.map((d) => [d.path.split('.')[0] ?? '_', d.message])));
      setServerError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-4">
      <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
        {def.fields.map((f) => {
          const id = `f-${f.name}`;
          const err = errors[f.name];
          const set = (v: string | boolean) => setValues((s) => ({ ...s, [f.name]: v }));
          const common = { id, name: f.name, 'aria-invalid': err ? true : undefined, placeholder: f.placeholder, className: 'input' } as const;
          return (
            <div key={f.name} className={cn('field', f.span === 2 && 'col-span-2')}>
              {f.type === 'checkbox' ? (
                <label className="mt-6 inline-flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={Boolean(values[f.name])} onChange={(e) => set(e.target.checked)} /> {f.label}
                </label>
              ) : (
                <>
                  <label htmlFor={id} className="text-xs font-medium text-[var(--text-muted)]">{f.label}</label>
                  {f.type === 'select' ? (
                    <select {...common} value={String(values[f.name] ?? '')} onChange={(e) => set(e.target.value)}>
                      {f.options?.map((o) => <option key={o} value={o}>{o || '—'}</option>)}
                    </select>
                  ) : f.type === 'textarea' ? (
                    <textarea {...common} value={String(values[f.name] ?? '')} onChange={(e) => set(e.target.value)} />
                  ) : (
                    <input {...common} type={f.type === 'csv' ? 'text' : f.type === 'number' ? 'text' : f.type} inputMode={f.type === 'number' ? 'decimal' : undefined}
                      value={String(values[f.name] ?? '')} onChange={(e) => set(e.target.value)} />
                  )}
                </>
              )}
              {err ? <span className="text-xs text-[var(--danger)]">{err}</span> : f.hint ? <span className="text-xs text-[var(--text-muted)]">{f.hint}</span> : null}
            </div>
          );
        })}
      </div>
      <ErrorBox error={serverError} />
      <div className="flex justify-end gap-2">
        {onCancel && <Button type="button" variant="ghost" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" disabled={busy}>{busy ? 'Saving…' : submitLabel}</Button>
      </div>
    </form>
  );
}
