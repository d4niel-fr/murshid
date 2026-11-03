'use client';

import { explainCard, generateCards, generateNotes, type GenCard } from '@murshid/study';
import { request } from './http';

export type Engine = 'model' | 'rules' | 'device';
export interface Generated { engine: Engine; model?: string | null; cards: GenCard[]; notes: { title: string; body: string } | null }

/**
 * Cards and/or notes from material. The server answers first (a model when one is configured, else its rule
 * engine); with no server the same rules run here, so it always works offline.
 */
export async function generate(devUser: string, text: string, kind: 'cards' | 'notes' | 'both', opts: { title?: string; max?: number } = {}): Promise<Generated> {
  try {
    const r = await request<Generated>('/study/generate', { method: 'POST', body: { text: text.slice(0, 60_000), kind, title: opts.title, max: opts.max ?? 30 }, headers: { 'x-dev-user': devUser, 'x-dev-user-id': devUser }, timeoutMs: 25_000 });
    if (r && Array.isArray(r.cards)) return r;
  } catch { /* offline or no server: the rules below */ }
  return {
    engine: 'device',
    cards: kind === 'notes' ? [] : generateCards(text, { max: opts.max ?? 30 }),
    notes: kind === 'cards' ? null : generateNotes(text, opts.title),
  };
}

export type ExplainStyle = 'simple' | 'example' | 'mnemonic' | 'deeper';
export async function explain(devUser: string, front: string, back: string, style: ExplainStyle, context = ''): Promise<{ text: string; engine: Engine }> {
  try {
    const r = await request<{ text: string; engine: Engine }>('/study/explain', { method: 'POST', body: { front, back, style, context: context.slice(0, 6000) }, headers: { 'x-dev-user': devUser, 'x-dev-user-id': devUser }, timeoutMs: 15_000 });
    if (r?.text) return r;
  } catch { /* fall back */ }
  const e = explainCard(front, back, context);
  const text = style === 'example' ? (e.example ?? `Make your own example: where would you meet "${front}" in real life? Add it to the back of the card.`)
    : style === 'mnemonic' ? (e.mnemonic ?? `Picture "${front}" happening in the room you revise in, then say the answer out loud once.`)
    : style === 'deeper' ? [e.simple, ...e.related].join(' ') : e.simple;
  return { text, engine: 'device' };
}

/** A deck as a link anyone can open to copy it (the cards travel in the link itself; nothing is stored online). */
export function shareLink(deck: { title: string; subject: string }, cards: { front: string; back: string }[]): string {
  const json = JSON.stringify({ v: 1, t: deck.title, s: deck.subject, c: cards.slice(0, 300).map((c) => [c.front, c.back]) });
  const b64 = btoa(String.fromCharCode(...new TextEncoder().encode(json))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return `${window.location.origin}/app/study/import#d=${b64}`;
}
export function readShareLink(hash: string): { title: string; subject: string; cards: { front: string; back: string }[] } | null {
  const m = /d=([A-Za-z0-9_-]+)/.exec(hash); if (!m) return null;
  try {
    const bin = atob(m[1]!.replace(/-/g, '+').replace(/_/g, '/'));
    const json = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (ch) => ch.charCodeAt(0)))) as { v: number; t: string; s: string; c: [string, string][] };
    if (json.v !== 1 || !Array.isArray(json.c)) return null;
    return { title: String(json.t).slice(0, 120), subject: String(json.s).slice(0, 40), cards: json.c.filter((p) => Array.isArray(p) && p[0] && p[1]).map(([front, back]) => ({ front: String(front).slice(0, 400), back: String(back).slice(0, 1200) })) };
  } catch { return null; }
}

/** Download text as a file. */
export function download(name: string, text: string, type = 'text/plain') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
