import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Murshid', short_name: 'Murshid', description: 'The AI study planner for UAE students and schools.',
    start_url: '/app', display: 'standalone', background_color: '#ffffff', theme_color: '#0f2f63', lang: 'en', dir: 'auto',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }],
    categories: ['education', 'productivity'],
  };
}
