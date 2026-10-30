'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Autosave a form draft to this device: restores on mount, saves (debounced) on change, and clears on submit.
 * Returns the draft, a setter, the save status and `clear()`.
 */
export function useAutosave<T extends object>(key: string, initial: T, delay = 500) {
  const storageKey = `murshid:draft:${key}`;
  const [value, setValue] = useState<T>(initial);
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'restored'>('idle');
  const loaded = useRef(false);
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { setValue({ ...initial, ...JSON.parse(raw) }); setStatus('restored'); }
    } catch { /* ignore */ }
    loaded.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  useEffect(() => {
    if (!loaded.current) return;
    setStatus((s) => (s === 'restored' ? s : 'saving'));
    const t = setTimeout(() => {
      try { localStorage.setItem(storageKey, JSON.stringify(value)); setStatus('saved'); } catch { setStatus('idle'); }
    }, delay);
    return () => clearTimeout(t);
  }, [value, storageKey, delay]);
  const clear = () => { try { localStorage.removeItem(storageKey); } catch { /* ignore */ } setStatus('idle'); };
  return { value, setValue, status, clear };
}
