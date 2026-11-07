'use client';

import type { Session, SupabaseClient } from '@supabase/supabase-js';

/**
 * Staff sign-in for the live product (Supabase Auth: Microsoft 365, Google or email). The portal shares the
 * student app's domain, so one sign-in works for both. Off when NEXT_PUBLIC_SUPABASE_URL is not set (demo).
 */
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
export const authEnabled = Boolean(URL_ && ANON);

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
  return (await (await s).auth.getSession()).data.session;
}
export async function bearer(): Promise<Record<string, string> | null> {
  const s = authEnabled ? await getSession() : null;
  return s ? { authorization: `Bearer ${s.access_token}` } : null;
}
const back = () => `${window.location.origin}/admin/login`;
export async function withProvider(provider: 'azure' | 'google') {
  const s = await supabase()!;
  return s.auth.signInWithOAuth({ provider, options: { redirectTo: back(), scopes: provider === 'azure' ? 'email openid profile' : undefined } });
}
export async function emailLink(email: string) { const s = await supabase()!; return s.auth.signInWithOtp({ email, options: { emailRedirectTo: back(), shouldCreateUser: false } }); }
export async function signOut() { const s = supabase(); if (s) await (await s).auth.signOut(); }
