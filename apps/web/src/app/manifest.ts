import type { MetadataRoute } from 'next';

/** Installable app: Home Screen on iPhone and iPad, an app on Android and desktop Chrome/Edge. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/app', name: 'Murshid', short_name: 'Murshid', description: 'The AI study planner for UAE students and schools.',
    start_url: '/app?source=pwa', scope: '/', display: 'standalone', display_override: ['standalone', 'minimal-ui'], orientation: 'any',
    background_color: '#ffffff', theme_color: '#0f2f63', lang: 'en', dir: 'auto',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' },
    ],
    shortcuts: [
      { name: 'Today', short_name: 'Today', url: '/app/planner', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Check-in', short_name: 'Check-in', url: '/app/feelings', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Timetable', short_name: 'Timetable', url: '/app/timetable', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Ask Murshid', short_name: 'Ask', url: '/app/chat', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
    categories: ['education', 'productivity'],
  };
}
