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
    return [
      { source: '/activities', destination: '/extracurriculars', permanent: false },
      { source: '/clubs', destination: '/extracurriculars', permanent: false },
      { source: '/today', destination: '/planner', permanent: false },
      { source: '/profile/links', destination: '/profile', permanent: false },
      { source: '/cv', destination: '/profile', permanent: false },
      { source: '/portfolio', destination: '/profile', permanent: false },
      { source: '/applications', destination: '/opportunities?tab=applications', permanent: false },
      { source: '/university', destination: '/opportunities?tab=applications', permanent: false },
      { source: '/competitions', destination: '/opportunities', permanent: false },
      { source: '/careers', destination: '/opportunities', permanent: false },
      { source: '/subjects', destination: '/academics', permanent: false },
      { source: '/schoolwork', destination: '/academics', permanent: false },
      { source: '/badges', destination: '/goals', permanent: false },
      { source: '/charts', destination: '/insights', permanent: false },
    ];
  },
};

export default nextConfig;
