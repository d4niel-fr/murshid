'use client';

import { useApp } from '@/components/providers/app-provider';
import { subjectName } from '@/lib/subjects';

/** `<option>`s for a subject picker: the stored value stays English, the label follows the student's language. */
export function SubjectOptions({ list }: { list: readonly string[] }) {
  const { locale } = useApp();
  return <>{list.map((x) => <option key={x} value={x}>{subjectName(x, locale)}</option>)}</>;
}

/** A subject name in the student's language. */
export function Subject({ name }: { name: string }) {
  const { locale } = useApp();
  return <>{subjectName(name, locale)}</>;
}
