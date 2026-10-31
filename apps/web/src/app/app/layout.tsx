import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/shell/app-shell';

// The student app shows a signed-in (demo) student's own data: useful to people, not to search results.
export const metadata: Metadata = { robots: { index: false, follow: true } };

export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
