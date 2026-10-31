import type { NextConfig } from 'next';

// One Vercel project serves all three apps on one domain (root vercel.json): this app at /, the teacher portal at
// /admin, the API at /api. Locally (`pnpm dev`, no Vercel) the same paths are proxied to the other dev servers.
const onVercel = Boolean(process.env.VERCEL);
const API_DEV = process.env.MURSHID_API_DEV_ORIGIN ?? 'http://localhost:8787';
const ADMIN_DEV = process.env.MURSHID_ADMIN_DEV_ORIGIN ?? 'http://localhost:3001';
// canonical URLs: an explicit NEXT_PUBLIC_SITE_URL, else the project's production domain on Vercel
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@murshid/design', '@murshid/grade-bands', '@murshid/survey'],
  ...(siteUrl ? { env: { NEXT_PUBLIC_SITE_URL: siteUrl } } : {}),
  async rewrites() {
    if (onVercel) return []; // Vercel routes /api and /admin to their own services before this app sees them
    return [
      { source: '/api', destination: `${API_DEV}/` },
      { source: '/api/:path*', destination: `${API_DEV}/:path*` },
      { source: '/admin', destination: `${ADMIN_DEV}/admin` },
      { source: '/admin/:path*', destination: `${ADMIN_DEV}/admin/:path*` },
    ];
  },
  // Workspace packages use NodeNext-style `./x.js` specifiers for `.ts` files. Turbopack (Next 16) cannot alias
  // extensions yet, so the app builds with webpack (`next build --webpack`) and this alias.
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs'] };
    return config;
  },
  // Aliases so nav hrefs from @murshid/grade-bands (NAV_CATALOG) never dead-end.
  async redirects() {
    const app = ['chat', 'planner', 'academics', 'extracurriculars', 'goals', 'opportunities', 'profile', 'settings', 'insights', 'school', 'study', 'saved'];
    return [
      // the landing page moved from /judges to /, the student app from / to /app
      { source: '/judges', destination: '/', permanent: true },
      { source: '/dashboard', destination: '/app', permanent: true },
      ...app.map((r) => ({ source: `/${r}/:path*`, destination: `/app/${r}/:path*`, permanent: true })),
      // nav hrefs from @murshid/grade-bands (NAV_CATALOG) never dead-end
      ...[['activities', 'extracurriculars'], ['clubs', 'extracurriculars'], ['today', 'planner'], ['profile/links', 'profile'], ['cv', 'profile'], ['portfolio', 'profile'],
        ['applications', 'opportunities?tab=applications'], ['university', 'opportunities?tab=applications'], ['competitions', 'opportunities'], ['careers', 'opportunities'],
        ['subjects', 'academics'], ['schoolwork', 'academics'], ['badges', 'goals'], ['charts', 'insights']]
        .flatMap(([from, to]) => [{ source: `/${from}`, destination: `/app/${to}`, permanent: false }, { source: `/app/${from}`, destination: `/app/${to}`, permanent: false }]),
    ];
  },
};

export default nextConfig;
