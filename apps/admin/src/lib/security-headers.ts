/**
 * Security headers for every page and file this app serves (used by next.config.ts headers()). The same file is in
 * apps/web/src/lib/security-headers.ts (the student app); the portal turns the microphone and camera off.
 *
 * Content-Security-Policy, in short: everything comes from this site, except the calls to Supabase (sign-in, https and
 * wss) and an API on another origin when NEXT_PUBLIC_MURSHID_API points at one. No plugins, no <base> tricks, forms only
 * post here, and nobody may put the site in a frame.
 *
 * Why script-src and style-src keep 'unsafe-inline': Next.js writes small inline scripts into every page (the
 * streamed page data and the hydration bootstrap) and React writes style="" attributes. Nonces would need every page,
 * the marketing site included, to be rendered per request (no static pages, no CDN cache). XSS is kept out instead by
 * React's escaping, no raw HTML from users or AI (the notes Markdown renderer builds React elements), and the rest of
 * this policy: no other script origins, no eval in production, object-src 'none', base-uri 'self'.
 */
export interface HeaderOptions {
  /** next dev: React needs eval for fast refresh, and the dev server talks over a websocket */
  dev: boolean;
  /** served over https (Vercel): ask browsers to upgrade any http link */
  https: boolean;
  /** NEXT_PUBLIC_SUPABASE_URL: sign-in calls (https) and live updates (wss) */
  supabaseUrl?: string;
  /** NEXT_PUBLIC_MURSHID_API when it is a full URL on another origin */
  apiUrl?: string;
  /** browser features the app uses: microphone (dictation, reading practice), camera (photo hand-ins) */
  microphone: boolean;
  camera: boolean;
}

const originOf = (u: string | undefined): string | null => {
  if (!u || !/^https?:\/\//i.test(u)) return null;
  try { return new URL(u).origin; } catch { return null; }
};

export function contentSecurityPolicy(o: HeaderOptions): string {
  const supabase = originOf(o.supabaseUrl);
  const connect = ["'self'", supabase, supabase?.replace(/^http/, 'ws'), originOf(o.apiUrl), ...(o.dev ? ['ws:', 'http://localhost:*'] : [])].filter(Boolean);
  const csp: Record<string, string[]> = {
    'default-src': ["'self'"],
    'script-src': ["'self'", "'unsafe-inline'", ...(o.dev ? ["'unsafe-eval'"] : [])],
    'style-src': ["'self'", "'unsafe-inline'"],
    'img-src': ["'self'", 'data:', 'blob:'],
    'font-src': ["'self'", 'data:'],
    'media-src': ["'self'", 'blob:'],
    'connect-src': [...new Set(connect as string[])],
    // the service worker (/sw.js) and the PDF reader's worker are files from this site
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    // previews of the student's own PDF (a blob: URL) are shown in a frame
    'frame-src': ["'self'", 'blob:'],
    'object-src': ["'none'"],
    'base-uri': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
  };
  const parts = Object.entries(csp).map(([k, v]) => `${k} ${v.join(' ')}`);
  if (o.https) parts.push('upgrade-insecure-requests');
  return parts.join('; ');
}

export function permissionsPolicy(o: Pick<HeaderOptions, 'microphone' | 'camera'>): string {
  return [
    `camera=${o.camera ? '(self)' : '()'}`, `microphone=${o.microphone ? '(self)' : '()'}`,
    'geolocation=()', 'payment=()', 'usb=()', 'serial=()', 'hid=()', 'bluetooth=()', 'midi=()',
    'magnetometer=()', 'gyroscope=()', 'accelerometer=()', 'display-capture=()', 'browsing-topics=()',
  ].join(', ');
}

export function securityHeaders(o: HeaderOptions): { key: string; value: string }[] {
  return [
    { key: 'Content-Security-Policy', value: contentSecurityPolicy(o) },
    { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: permissionsPolicy(o) },
    { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
    { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
  ];
}
