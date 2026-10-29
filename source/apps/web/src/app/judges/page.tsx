import type { Metadata } from 'next';
import { Landing } from './landing';

export const metadata: Metadata = {
  title: 'Murshid · an AI agent for the school week',
  description: 'Murshid plans a UAE high-school student’s week, acts in their planner, explains itself, and tells teachers who needs support. Try the student, teacher and admin demos in one click.',
};

export default function JudgesPage() {
  return <Landing />;
}
