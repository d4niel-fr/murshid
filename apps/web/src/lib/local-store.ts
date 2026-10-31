'use client';

import { useSyncExternalStore } from 'react';

/**
 * A tiny persistent store: state lives in memory, is written to localStorage (debounced) and stays in sync across
 * tabs. Server render and first paint use `initial()`, so hydration markup always matches.
 */
export interface LocalStore<T> {
  get(): T;
  set(next: T | ((cur: T) => T)): void;
  subscribe(listener: () => void): () => void;
  /** React hook: re-renders when the state changes */
  use(): T;
}

export function createLocalStore<T>(key: string, initial: () => T, opts: { version?: number; migrate?: (raw: unknown) => T | null } = {}): LocalStore<T> {
  const storageKey = `murshid:${key}:v${opts.version ?? 1}`;
  let state: T | undefined;
  let serverState: T | undefined;
  const listeners = new Set<() => void>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const load = (): T => {
    if (typeof window === 'undefined') return initial();
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        const migrated = opts.migrate ? opts.migrate(parsed) : (parsed as T);
        if (migrated) return migrated;
      }
    } catch { /* storage blocked or corrupt: start fresh */ }
    return initial();
  };
  const emit = () => { for (const l of listeners) l(); };
  // another tab changed it: reload and re-render
  const onStorage = (e: StorageEvent) => { if (e.key === storageKey) { state = load(); emit(); } };
  const persist = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      try { window.localStorage.setItem(storageKey, JSON.stringify(state)); } catch { /* quota or private mode */ }
    }, 120);
  };

  const store: LocalStore<T> = {
    get() { if (state === undefined) state = load(); return state; },
    set(next) {
      const cur = store.get();
      state = typeof next === 'function' ? (next as (c: T) => T)(cur) : next;
      persist(); emit();
    },
    subscribe(listener) {
      listeners.add(listener);
      if (listeners.size === 1 && typeof window !== 'undefined') window.addEventListener('storage', onStorage);
      return () => {
        listeners.delete(listener);
        if (listeners.size === 0 && typeof window !== 'undefined') window.removeEventListener('storage', onStorage);
      };
    },
    use() {
      // eslint-disable-next-line react-hooks/rules-of-hooks
      return useSyncExternalStore(store.subscribe, store.get, () => (serverState ??= initial()));
    },
  };
  return store;
}

export const uid = (prefix = '') => `${prefix}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
