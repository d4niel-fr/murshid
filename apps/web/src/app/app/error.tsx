'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/components/shared/states';

/** A page in the app failed to render: say so plainly and offer a retry (the rest of the shell keeps working). */
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <div className="mx-auto max-w-[760px] px-4 py-10"><ErrorState title="Something went wrong on this page" detail="It is not you. Try again, and if it keeps happening, reload the page. Your notes and settings are safe on this device." onRetry={reset} /></div>;
}
