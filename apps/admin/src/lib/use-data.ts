'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Fetch an admin endpoint; `reload()` after a write. */
export function useData<T = any>(path: string | null, as?: 'admin' | 'staff' | 'public') {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    if (!path) return;
    setLoading(true);
    try {
      setData(await api<T>(path, { as }));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [path, as]);
  useEffect(() => { void reload(); }, [reload]);
  return { data, error, loading, reload };
}
