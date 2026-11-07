'use client';

import { Footer, MarketingShell } from '@/components/marketing/chrome';
import { Hero } from './hero';
import { BuiltSecure, Film, Guardrails, Numbers, Seats, Steps, Trust, Views } from './sections';

/** The landing page: hero → trust → how it works → two views → the film → numbers → guardrails → built secure → seats → footer. */
export function Landing() {
  return (
    <MarketingShell intro>
      <main>
        <Hero />
        <Trust />
        <Steps />
        <Views />
        <Film />
        <Numbers />
        <Guardrails />
        <BuiltSecure />
        <Seats />
      </main>
      <Footer />
    </MarketingShell>
  );
}
