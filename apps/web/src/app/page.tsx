import type { Metadata } from 'next';
import { Landing } from '@/components/landing/landing';

export const metadata: Metadata = {
  title: { absolute: 'Murshid · the AI study planner for UAE students and schools' },
  description: 'Murshid plans a student’s week around tests, homework and sport, shows its working, and tells teachers who needs support. Try the student, teacher and admin demos in one click.',
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <Landing />;
}
