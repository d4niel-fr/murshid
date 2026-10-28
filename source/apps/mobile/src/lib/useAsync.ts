import { useCallback, useEffect, useRef, useState } from 'react';

export function useAsync<T>(fn: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const alive = useRef(true);
  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const v = await fn();
      if (alive.current) setData(v);
    } catch (e) {
      if (alive.current) setError(e instanceof Error ? e : new Error(String(e)));
    } finally {
      if (alive.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    alive.current = true;
    run();
    return () => {
      alive.current = false;
    };
  }, [run]);
  return { data, error, loading, reload: run, setData };
}
