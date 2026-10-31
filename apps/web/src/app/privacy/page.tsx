import type { Metadata } from 'next';
import { PrivacyView } from '@/components/marketing/privacy';
import { breadcrumbLd, jsonLd } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Privacy and cookies',
  description: 'How Murshid uses student data: consent per purpose, separate school and family data, human approval before anything is sent, an audit log, and essential-only storage.',
  alternates: { canonical: '/privacy' },
};

export default function PrivacyPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd([['Privacy and cookies', '/privacy']]))} />
      <PrivacyView />
    </>
  );
}
