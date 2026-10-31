'use client';

import { useParams } from 'next/navigation';
import { NotebookEditor } from '@/components/study/notebook';

export default function NotebookPage() {
  const { id } = useParams<{ id: string }>();
  return <NotebookEditor id={id} />;
}
