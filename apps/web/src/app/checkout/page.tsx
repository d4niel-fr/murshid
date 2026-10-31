import type { Metadata } from 'next';
import { Suspense } from 'react';
import { CheckoutView } from '@/components/marketing/checkout';

export const metadata: Metadata = {
  title: 'Checkout: Single plan',
  description: 'Get Murshid Single for one student: AED 29 a month or AED 249 a year.',
  robots: { index: false, follow: true },
  alternates: { canonical: '/checkout' },
};

export default function CheckoutPage() {
  return <Suspense fallback={null}><CheckoutView /></Suspense>;
}
