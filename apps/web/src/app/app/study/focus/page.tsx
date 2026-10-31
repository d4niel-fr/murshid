import { Suspense } from 'react';
import { FocusView } from '@/components/study/focus';

export const metadata = { title: 'Focus timer' };

export default function FocusPage() {
  return <Suspense fallback={null}><FocusView /></Suspense>;
}
