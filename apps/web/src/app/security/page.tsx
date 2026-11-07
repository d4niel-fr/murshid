import type { Metadata } from 'next';
import { SecurityView } from '@/components/marketing/security';
import { breadcrumbLd, jsonLd } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Security and privacy',
  description: 'How Murshid protects student data: encryption in transit, row-level security, rate limits, file checks, least-privilege keys, data kept in one region, export and delete, and how to report a problem.',
  alternates: { canonical: '/security' },
};

export default function SecurityPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd([['Security and privacy', '/security']]))} />
      <SecurityView />
    </>
  );
}
