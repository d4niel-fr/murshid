import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CheckoutSuccess } from '@/components/marketing/checkout';

export const metadata: Metadata = { title: 'Welcome to Murshid', robots: { index: false, follow: false } };

export default function CheckoutSuccessPage() {
  return <Suspense fallback={null}><CheckoutSuccess /></Suspense>;
}
