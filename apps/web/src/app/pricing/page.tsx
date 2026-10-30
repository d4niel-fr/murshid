import type { Metadata } from 'next';
import { PricingView } from '@/components/marketing/pricing';
import { APP_LD, breadcrumbLd, jsonLd } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Pricing: Single and School plans',
  description: 'Two plans. Single: AED 29 a month or AED 249 a year for one student, bought online. School: AED 150 per student a year with the teacher portal, set up with the school.',
  alternates: { canonical: '/pricing' },
};

export default function PricingPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([APP_LD, breadcrumbLd([['Pricing', '/pricing']])])} />
      <PricingView />
    </>
  );
}
