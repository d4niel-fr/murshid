import type { Metadata } from 'next';
import { HowItWorks } from './view';

export const metadata: Metadata = { title: 'How Murshid works', description: 'The agent loop, the tools it may use, six guardrails and model routing: what the code behind Murshid actually does.', alternates: { canonical: '/how-it-works' } };

export default function HowItWorksPage() {
  return <HowItWorks />;
}
