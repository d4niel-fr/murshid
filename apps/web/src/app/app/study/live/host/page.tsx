import { Suspense } from 'react';
import { LiveHost } from '@/components/study/live';

export const metadata = { title: 'Host a live quiz' };

export default function LiveHostPage() {
  return <Suspense><LiveHost /></Suspense>;
}
