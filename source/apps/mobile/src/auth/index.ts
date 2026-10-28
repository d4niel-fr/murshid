import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

export type Provider = 'google' | 'azure';
export interface AuthUser {
  id: string;
  email: string | null;
  provider: Provider | 'demo';
  accessToken: string | null;
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
export const isAuthConfigured = SUPABASE_URL.length > 0;

/**
 * Placeholder Supabase OAuth.
 * - With EXPO_PUBLIC_SUPABASE_URL set: opens Supabase's hosted /auth/v1/authorize flow and reads the
 *   access_token from the redirect fragment. (Swap for @supabase/supabase-js + PKCE when the db team ships the project.)
 * - Without it: returns a local placeholder user so the app runs standalone.
 */
export async function signInWith(provider: Provider): Promise<AuthUser | null> {
  if (!isAuthConfigured) {
    return { id: `local-${provider}`, email: null, provider, accessToken: null };
  }
  const redirectTo = Linking.createURL('auth-callback');
  const url = `${SUPABASE_URL.replace(/\/+$/, '')}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(redirectTo)}`;
  const res = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (res.type !== 'success') return null;
  const fragment = res.url.split('#')[1] ?? '';
  const params = new URLSearchParams(fragment);
  const accessToken = params.get('access_token');
  if (!accessToken) return null;
  return { id: 'supabase-user', email: null, provider, accessToken };
}

export function demoUser(): AuthUser {
  return { id: 'auth-demo-aisha', email: 'aisha.test@example.org', provider: 'demo', accessToken: null };
}
