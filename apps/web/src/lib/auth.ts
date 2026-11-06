'use client';

import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * Sign-in for the real product (Supabase Auth: email and password, an emailed link, Google, Microsoft).
 * Off when NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY are not set: the site then runs as the demo, with
 * demo students instead of accounts. The client library loads only when sign-in is on.
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const authEnabled = Boolean(URL_ && ANON);
export type Provider = 'google' | 'azure';

let client: Promise<SupabaseClient> | null = null;
export function supabase(): Promise<SupabaseClient> | null {
  if (!authEnabled || typeof window === 'undefined') return null;
  client ??= import('@supabase/supabase-js').then(({ createClient }) => createClient(URL_, ANON, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce', storageKey: 'murshid:auth' },
  }));
  return client;
}

export async function getSession(): Promise<Session | null> {
  const s = supabase(); if (!s) return null;
  const { data } = await (await s).auth.getSession();
  return data.session;
}

/** Headers that say who is asking: the sign-in token, or the demo student when sign-in is off. */
/** Parents with more than one child: which child the app is showing (sent as x-child). */
export const CHILD_KEY = 'murshid:child';
export function chosenChild(): string | null {
  try { return typeof window === 'undefined' ? null : window.localStorage.getItem(CHILD_KEY); } catch { return null; }
}

export async function authHeaders(devUser?: string | null): Promise<Record<string, string>> {
  const session = authEnabled ? await getSession() : null;
  if (session) { const child = chosenChild(); return { authorization: `Bearer ${session.access_token}`, ...(child ? { 'x-child': child } : {}) }; }
  return devUser ? { 'x-dev-user': devUser, 'x-dev-user-id': devUser } : {};
}

/** Where a sign-in link or provider sends the person back to (then on to `next`). */
export const callbackUrl = (next = '/app') => `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`;
/** Only same-site paths, so a link can never send someone to another website after signing in. */
export function safeNext(next: string | null | undefined, fallback = '/app'): string {
  if (!next || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\') || /[\r\n]/.test(next)) return fallback;
  return next;
}

export async function signInWithPassword(email: string, password: string) {
  const s = await supabase()!; return s.auth.signInWithPassword({ email, password });
}
export async function signUp(email: string, password: string, name: string, next?: string) {
  const s = await supabase()!; return s.auth.signUp({ email, password, options: { data: { full_name: name }, emailRedirectTo: callbackUrl(next) } });
}
export async function emailLink(email: string, next?: string) {
  const s = await supabase()!; return s.auth.signInWithOtp({ email, options: { emailRedirectTo: callbackUrl(next) } });
}
export async function withProvider(provider: Provider, next?: string) {
  const s = await supabase()!;
  return s.auth.signInWithOAuth({ provider, options: { redirectTo: callbackUrl(next), scopes: provider === 'azure' ? 'email openid profile' : undefined } });
}
export async function resetPassword(email: string) {
  const s = await supabase()!; return s.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/sign-in?reset=1')}` });
}
export async function setNewPassword(password: string) {
  const s = await supabase()!; return s.auth.updateUser({ password });
}
export async function signOut() {
  const s = supabase(); if (!s) return;
  await (await s).auth.signOut();
}
export function onAuthChange(fn: (session: Session | null) => void): () => void {
  const s = supabase(); if (!s) return () => {};
  let unsub = () => {};
  void s.then((c) => { const { data } = c.auth.onAuthStateChange((_e, session) => fn(session)); unsub = () => data.subscription.unsubscribe(); });
  return () => unsub();
}
