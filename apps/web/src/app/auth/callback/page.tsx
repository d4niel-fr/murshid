import type { Metadata } from 'next';
import { Suspense } from 'react';
import { AuthCallback } from '@/components/account/sign-in-view';

export const metadata: Metadata = { title: 'Signing you in', robots: { index: false, follow: false } };

export default function CallbackPage() {
  return <Suspense fallback={null}><AuthCallback /></Suspense>;
}
