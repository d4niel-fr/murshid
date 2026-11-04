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

/** Fired on `window` when a write does not fit in this device's storage. */
export const STORAGE_FULL = 'murshid:storage-full';

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
  const write = () => {
    timer = null;
    try { window.localStorage.setItem(storageKey, JSON.stringify(state)); }
    catch (e) {
      // out of room (often pictures on boards and notebooks): say so once, instead of losing work silently
      if (e instanceof DOMException && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED')) window.dispatchEvent(new CustomEvent(STORAGE_FULL, { detail: { key } }));
    }
  };
  // a tab closed inside the debounce window still saves what was just done
  const flush = () => { if (timer) { clearTimeout(timer); write(); } };
  const persist = () => {
    if (timer) clearTimeout(timer);
    else if (typeof window !== 'undefined') window.addEventListener('pagehide', flush, { once: true });
    timer = setTimeout(write, 120);
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
