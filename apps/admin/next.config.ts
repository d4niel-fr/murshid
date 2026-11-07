import type { NextConfig } from 'next';
import { securityHeaders } from './src/lib/security-headers';

// The teacher and school portal is served under /admin (the "admin" service in the root vercel.json), next to the
// student app at / and the API at /api. Locally, /api is proxied to the API dev server.
const basePath = '/admin';
const API_DEV = process.env.MURSHID_API_DEV_ORIGIN ?? 'http://localhost:8787';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  basePath,
  poweredByHeader: false,
  // CSP, HSTS, no framing, nosniff, referrer and browser-feature rules on every page (see src/lib/security-headers.ts);
  // the portal uses neither the microphone nor the camera (photos are picked as files)
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders({
      dev: process.env.NODE_ENV === 'development', https: Boolean(process.env.VERCEL),
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL, apiUrl: process.env.NEXT_PUBLIC_MURSHID_API,
      microphone: false, camera: false,
    }) }];
  },
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
