import type { Metadata } from 'next';
import { FaqView } from '@/components/marketing/faq';
import { FAQS } from '@/lib/faq';
import { breadcrumbLd, jsonLd } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Help and FAQ',
  description: 'Answers about Murshid: how it plans a week, the study tools, the teacher portal, Single and School plans, Arabic support, and how student data is kept private.',
  alternates: { canonical: '/faq' },
};

const FAQ_LD = {
  '@context': 'https://schema.org', '@type': 'FAQPage',
  mainEntity: FAQS.map((f) => ({ '@type': 'Question', name: f.q.en, acceptedAnswer: { '@type': 'Answer', text: f.a.en } })),
};

export default function FaqPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([FAQ_LD, breadcrumbLd([['Help and FAQ', '/faq']])])} />
      <FaqView />
    </>
  );
}
