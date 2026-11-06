/**
 * Optional bot check (Cloudflare Turnstile) for sign-up style forms: account setup, checkout, the survey and the demo
 * sign-up. Off unless TURNSTILE_SECRET_KEY is set. When on, the form sends the widget's token in the
 * `cf-turnstile-response` header and the API asks Cloudflare whether it is valid before doing anything.
 * The web forms must show the widget first (site key in NEXT_PUBLIC_TURNSTILE_SITE_KEY); see docs/SECURITY.md.
 */
import type { MiddlewareHandler } from 'hono';
import type { AppEnv } from './context';
import { requestIdOf } from './middleware';
import { clientIp, type TrustProxy } from './security';

export const TURNSTILE_ROUTES = /^\/(account\/setup|billing\/checkout|survey|onboarding)$/;
const VERIFY = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export function turnstile(secret: string, trust: TrustProxy, f: typeof fetch = fetch): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    if (c.req.method !== 'POST' || !TURNSTILE_ROUTES.test(c.req.path)) return next();
    const token = c.req.header('cf-turnstile-response') ?? '';
    let ok = false;
    if (token && token.length <= 2048) {
      try {
        const res = await f(VERIFY, {
          method: 'POST', signal: AbortSignal.timeout(5000),
          body: new URLSearchParams({ secret, response: token, remoteip: clientIp(c, trust) }),
        });
        ok = Boolean(((await res.json()) as { success?: boolean }).success);
      } catch { ok = false; }
    }
    if (!ok) return c.json({ error: 'Please complete the check that you are not a robot, then try again.', code: 'captcha_required', requestId: requestIdOf(c) }, 403);
    return next();
  };
}
