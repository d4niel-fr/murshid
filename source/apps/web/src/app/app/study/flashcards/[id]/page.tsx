import { Suspense } from 'react';
import { DeckView } from '@/components/study/deck';
import { LoadingState } from '@/components/shared/states';

export const metadata = { title: 'Flashcard deck' };

export default function DeckPage() {
  return <Suspense fallback={<LoadingState />}><DeckView /></Suspense>;
}
