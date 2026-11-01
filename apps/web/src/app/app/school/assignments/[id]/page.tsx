'use client';

import { useParams } from 'next/navigation';
import { AssignmentView } from '@/components/school/assignment-view';

export default function AssignmentPage() {
  const { id } = useParams<{ id: string }>();
  return <AssignmentView id={decodeURIComponent(id)} />;
}
