import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Shell } from '@/components/shell';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Murshid Admin', template: '%s · Murshid Admin' },
  description: 'School staff portal: students, academics, activities, tasks, goals, opportunities and CVs that feed the Murshid student app.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" data-band="g11-12">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
