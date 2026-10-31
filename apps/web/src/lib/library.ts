'use client';

import { createLocalStore } from './local-store';

/** Saved for later: any page, opportunity, note or deck the student wants to come back to. */
export type SavedKind = 'page' | 'opportunity' | 'note' | 'deck' | 'faq';
export interface SavedItem { id: string; kind: SavedKind; title: string; href: string; savedAt: number }
export interface RecentItem { href: string; title: string; at: number }
interface LibraryState { saved: SavedItem[]; recent: RecentItem[] }

export const libraryStore = createLocalStore<LibraryState>('library', () => ({ saved: [], recent: [] }));
export const useLibrary = () => libraryStore.use();

const RECENT_MAX = 12;
const cleanTitle = (t: string) => t.replace(/\s*·\s*Murshid$/, '').trim() || 'Murshid';

export const library = {
  isSaved: (id: string) => libraryStore.get().saved.some((s) => s.id === id),
  toggle(item: Omit<SavedItem, 'savedAt'>): boolean {
    const on = library.isSaved(item.id);
    libraryStore.set((s) => ({ ...s, saved: on ? s.saved.filter((x) => x.id !== item.id) : [{ ...item, title: cleanTitle(item.title), savedAt: Date.now() }, ...s.saved] }));
    return !on;
  },
  remove(id: string) { libraryStore.set((s) => ({ ...s, saved: s.saved.filter((x) => x.id !== id) })); },
  visit(href: string, title: string) {
    if (!href || href.startsWith('/checkout/success')) return;
    libraryStore.set((s) => {
      const rest = s.recent.filter((r) => r.href !== href);
      return { ...s, recent: [{ href, title: cleanTitle(title), at: Date.now() }, ...rest].slice(0, RECENT_MAX) };
    });
  },
  clearRecent() { libraryStore.set((s) => ({ ...s, recent: [] })); },
};
