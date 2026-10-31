import type { Metadata } from 'next';
import SurveyView from './view';

export const metadata: Metadata = {
  title: 'Student and teacher survey',
  description: 'Tell us how your school week really works: a short anonymous survey that shapes what Murshid builds next.',
  alternates: { canonical: '/survey' },
};

export default function SurveyPage() {
  return <SurveyView />;
}
