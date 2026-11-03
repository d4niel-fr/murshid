import { Suspense } from 'react';
import { CreateView } from '@/components/study/create';

export const metadata = { title: 'Create with Murshid' };

export default function CreatePage() {
  return <Suspense><CreateView /></Suspense>;
}
