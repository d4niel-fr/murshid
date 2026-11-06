'use client';

import { useCallback, useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { ApiError } from '@/lib/http';

/** Load something for the signed-in student; `noSchool` when it needs a school licence they do not have. */
export function useLoad<T>(fn: (devUser: string) => Promise<T>) {
  const { client } = useApp();
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [noSchool, setNoSchool] = useState(false);
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  useEffect(() => {
    let live = true;
    fn(client.devUser).then((d) => { if (live) { setData(d); setError(null); } }).catch((e) => {
      if (!live) return;
      if (e instanceof ApiError && (e.code === 'no_school' || e.status === 404)) setNoSchool(true);
      else setError((e as Error).message);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client.devUser, tick]);
  return { data, setData, error, noSchool, reload };
}
