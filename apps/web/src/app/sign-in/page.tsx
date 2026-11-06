import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SignInView } from '@/components/account/sign-in-view';

export const metadata: Metadata = {
  title: 'Sign in',
  description: 'Sign in to Murshid with your email, Google or your school Microsoft account.',
  alternates: { canonical: '/sign-in' },
  robots: { index: false, follow: true },
};

export default function SignInPage() {
  return <Suspense fallback={null}><SignInView /></Suspense>;
}
