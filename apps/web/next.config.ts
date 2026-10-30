import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@murshid/design', '@murshid/grade-bands', '@murshid/survey'],
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
