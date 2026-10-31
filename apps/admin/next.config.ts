import type { NextConfig } from 'next';

// The teacher and school portal is served under /admin (the "admin" service in the root vercel.json), next to the
// student app at / and the API at /api. Locally, /api is proxied to the API dev server.
const basePath = '/admin';
const API_DEV = process.env.MURSHID_API_DEV_ORIGIN ?? 'http://localhost:8787';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  transpilePackages: ['@murshid/design', '@murshid/survey'],
  async rewrites() {
    if (process.env.VERCEL) return []; // on Vercel, /api is the "api" service
    return [
      { source: '/api', destination: `${API_DEV}/`, basePath: false },
      { source: '/api/:path*', destination: `${API_DEV}/:path*`, basePath: false },
    ];
  },
  webpack: (config) => {
    config.resolve ??= {};
    config.resolve.extensionAlias = { '.js': ['.ts', '.tsx', '.js'], '.mjs': ['.mts', '.mjs'] };
    return config;
  },
};

export default nextConfig;
