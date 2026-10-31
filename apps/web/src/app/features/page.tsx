import type { Metadata } from 'next';
import { FeaturesView } from '@/components/marketing/features';
import { breadcrumbLd, jsonLd } from '@/lib/site';

export const metadata: Metadata = {
  title: 'Study tools: flashcards, notes, focus timer and quizzes',
  description: 'Spaced-repetition flashcards, notes that turn into cards, a focus timer, quizzes and a topic tracker, plus a weekly plan that fits around school and sport.',
  alternates: { canonical: '/features' },
};

export default function FeaturesPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(breadcrumbLd([['Study tools', '/features']]))} />
      <FeaturesView />
    </>
  );
}
