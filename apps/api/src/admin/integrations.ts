/**
 * What is switched on in this deployment: each service, whether it is live or running as the demo, and which
 * settings it needs (names only, never values). Shown to Murshid admins in the portal (Integrations).
 */
import type { Api } from '../lib/router';
import { requireAdmin } from './routes';

export interface Integration { id: string; name: string; status: 'live' | 'demo'; what: string; keys: { name: string; set: boolean; optional?: boolean }[] }

export function integrations(env: Record<string, string | undefined>, live: { state: string; files: string; chat: string | null; authMode: string }): Integration[] {
  const has = (k: string) => Boolean(env[k]?.trim());
  const keys = (names: string[], optional: string[] = []) => [...names.map((name) => ({ name, set: has(name) })), ...optional.map((name) => ({ name, set: has(name), optional: true }))];
  const all = (names: string[]) => names.every(has);
  return [
    { id: 'database', name: 'Database (Supabase Postgres)', status: live.state === 'supabase' ? 'live' : 'demo', what: 'Saves everything students, teachers and parents do, shared by every server.', keys: keys(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) },
    { id: 'files', name: 'Files (Supabase Storage)', status: live.files === 'supabase' ? 'live' : 'demo', what: 'Hand-in photos, slides and PDFs (private bucket murshid-files).', keys: keys(['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY']) },
    { id: 'auth', name: 'Sign-in (Supabase Auth)', status: live.authMode === 'jwt' ? 'live' : 'demo', what: 'Email, Google and Microsoft sign-in. The web apps also need NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.', keys: keys(['AUTH_MODE'], ['SUPABASE_JWT_SECRET', 'SUPABASE_JWKS_URL', 'PLATFORM_ADMIN_EMAILS']) },
    { id: 'ai', name: 'AI models', status: live.chat ? 'live' : 'demo', what: 'Ask Murshid, study tools and explanations. Without a key, Murshid answers with its built-in rules.', keys: keys(['GATEWAY_MODE'], ['OPENROUTER_API_KEY', 'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY']) },
    { id: 'payments', name: 'Payments (Stripe)', status: has('STRIPE_SECRET_KEY') ? 'live' : 'demo', what: 'The Single plan, paid by card on Stripe’s page (AED 29 a month or AED 249 a year).', keys: keys(['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'PUBLIC_WEB_URL'], ['STRIPE_PRICE_MONTHLY', 'STRIPE_PRICE_YEARLY']) },
    { id: 'email', name: 'Email (Resend)', status: has('RESEND_API_KEY') ? 'live' : 'demo', what: 'Notifications by email for people who turn it on, and weekly summaries for parents.', keys: keys(['RESEND_API_KEY', 'RESEND_FROM'], ['RESEND_REPLY_TO']) },
    { id: 'push', name: 'Push notifications (Web Push)', status: all(['WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY']) ? 'live' : 'demo', what: 'Notifications on phones, iPads and computers (installed app or browser). Make keys with: npx web-push generate-vapid-keys. The web app also needs NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY.', keys: keys(['WEB_PUSH_PUBLIC_KEY', 'WEB_PUSH_PRIVATE_KEY'], ['WEB_PUSH_SUBJECT']) },
    { id: 'reminders', name: 'Daily reminders (cron)', status: has('CRON_SECRET') ? 'live' : 'demo', what: 'Every afternoon: work due tomorrow; Sundays: parent summaries (vercel.json crons).', keys: keys(['CRON_SECRET']) },
    { id: 'microsoft', name: 'Microsoft 365 (Teams classes)', status: all(['MS_CLIENT_ID', 'MS_CLIENT_SECRET']) ? 'live' : 'demo', what: 'Schools approve Murshid once; Teams classes, teachers, students and assignments sync.', keys: keys(['MS_CLIENT_ID', 'MS_CLIENT_SECRET'], ['MS_CONSENT_REDIRECT_URI', 'MS_STATE_SECRET']) },
  ];
}

export function registerIntegrations(api: Api, env: Record<string, string | undefined>, live: () => { state: string; files: string; chat: string | null; authMode: string }) {
  api.route({ method: 'get', path: '/admin/integrations', tag: 'admin', auth: 'custom', summary: 'Murshid admin: which services are live in this deployment, and which settings each needs (names only)' },
    async (c) => { await requireAdmin(c); const items = integrations(env, live()); return c.json({ items, live: items.filter((i) => i.status === 'live').length, total: items.length }); });
}
