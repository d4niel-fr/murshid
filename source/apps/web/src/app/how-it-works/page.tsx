import type { Metadata } from 'next';
import { HowItWorks } from './view';

export const metadata: Metadata = { title: 'How Murshid works', description: 'The agent loop, tools, guardrails and model routing behind Murshid.' };

export default function HowItWorksPage() {
  return <HowItWorks />;
}
