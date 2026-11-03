import { Suspense } from 'react';
import { LivePlay } from '@/components/study/live';

export const metadata = { title: 'Live quiz' };

export default function LivePlayPage() {
  return <Suspense><LivePlay /></Suspense>;
}
