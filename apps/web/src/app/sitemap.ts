import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

// Public, indexable pages only: the student app (/app) and checkout are noindex and left out on purpose.
const PAGES: [string, number, MetadataRoute.Sitemap[number]['changeFrequency']][] = [
  ['/', 1.0, 'weekly'], ['/how-it-works', 0.8, 'monthly'], ['/features', 0.8, 'monthly'], ['/pricing', 0.9, 'monthly'],
  ['/faq', 0.7, 'monthly'], ['/welcome', 0.6, 'monthly'], ['/survey', 0.4, 'monthly'], ['/privacy', 0.3, 'yearly'], ['/security', 0.3, 'yearly'],
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date('2026-10-30');
  return PAGES.map(([path, priority, changeFrequency]) => ({ url: `${SITE_URL}${path}`, lastModified, changeFrequency, priority }));
}
