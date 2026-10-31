/** Public site facts used by metadata, the sitemap and structured data. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://murshid-web.vercel.app').replace(/\/$/, '');
export const SITE_NAME = 'Murshid';
export const SITE_TAGLINE = 'The AI study planner for UAE students and schools';
export const PRICES = { singleMonthly: 29, singleYearly: 249, schoolPerStudent: 150, currency: 'AED' } as const;

export function jsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  return { __html: JSON.stringify(data).replace(/</g, '\\u003c') };
}

export const ORG_LD = {
  '@context': 'https://schema.org',
  '@graph': [
    { '@type': 'Organization', '@id': `${SITE_URL}/#org`, name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/icon.svg`, description: SITE_TAGLINE, areaServed: 'AE' },
    { '@type': 'WebSite', '@id': `${SITE_URL}/#site`, name: SITE_NAME, url: SITE_URL, inLanguage: ['en', 'ar'], publisher: { '@id': `${SITE_URL}/#org` } },
  ],
};

export const APP_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: SITE_NAME, applicationCategory: 'EducationalApplication', operatingSystem: 'Web', url: SITE_URL,
  description: 'Plans a student’s week around tests, homework and sport, explains every step, and shows teachers who needs support.',
  inLanguage: ['en', 'ar'],
  offers: [
    { '@type': 'Offer', name: 'Single plan (monthly)', price: String(PRICES.singleMonthly), priceCurrency: PRICES.currency, url: `${SITE_URL}/checkout?plan=single&billing=monthly`, category: 'subscription' },
    { '@type': 'Offer', name: 'Single plan (yearly)', price: String(PRICES.singleYearly), priceCurrency: PRICES.currency, url: `${SITE_URL}/checkout?plan=single&billing=yearly`, category: 'subscription' },
  ],
};

export function breadcrumbLd(trail: [string, string][]) {
  return {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: [['Home', '/'], ...trail].map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: `${SITE_URL}${path}` })),
  };
}
