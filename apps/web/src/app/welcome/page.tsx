import type { Metadata } from 'next';
import WelcomeView from './view';

export const metadata: Metadata = {
  title: 'Get Murshid',
  description: 'Join through your school with Microsoft 365, or as a family with the Single plan.',
  alternates: { canonical: '/welcome' },
};

export default function WelcomePage() {
  return <WelcomeView />;
}
