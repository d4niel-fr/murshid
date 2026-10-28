import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-4xl font-semibold tabular">404</p>
      <p className="text-muted-foreground">This page doesn&apos;t exist.</p>
      <Link href="/" className="rounded-sm bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Back to dashboard</Link>
    </div>
  );
}
