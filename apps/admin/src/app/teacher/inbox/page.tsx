'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { CheckCircle2, ClipboardCheck, HelpCircle, MessageCircle } from 'lucide-react';
import { useEffect, useState, type ReactNode } from 'react';
import { PageHeader } from '@/components/shell';
import { Badge, Card, EmptyState, ErrorBox, SkeletonRows } from '@/components/ui';
import { getSession } from '@/lib/api';
import { useData } from '@/lib/use-data';

/* eslint-disable @typescript-eslint/no-explicit-any */

const when = (iso: string) => new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** One place for everything waiting on the teacher, across all their classes. */
export default function TeacherInbox() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => { if (!getSession()) router.replace('/login'); else setReady(true); }, [router]);
  const d = useData<any>(ready ? '/teacher/inbox' : null, 'staff');
  const review = (x: any) => `/teacher/assignments/${encodeURIComponent(x.itemId)}?class=${x.classId}&student=${x.studentId}`;
  return (
    <>
      <PageHeader title="Inbox" sub={d.data ? (d.data.total ? `${d.data.total} thing${d.data.total === 1 ? '' : 's'} waiting on you` : 'All caught up') : 'Hand-ins to review, messages and questions from every class'} />
      <ErrorBox error={d.error} />
      {!d.data ? <Card pad={false}><SkeletonRows rows={5} /></Card> : !d.data.total ? (
        <Card><EmptyState icon={<CheckCircle2 />} title="All caught up">New hand-ins, private messages and questions under your announcements land here.</EmptyState></Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Section icon={<ClipboardCheck className="size-4" />} title="To review" count={d.data.toReview.length} empty="Nothing new to mark.">
            {d.data.toReview.map((x: any) => (
              <Row key={`${x.itemId}-${x.studentId}`} href={review(x)} title={x.name} sub={`${x.title} · ${x.className}`} meta={<>{x.resubmitted && <Badge tone="info">Resubmitted</Badge>}{x.late && <Badge tone="warning">Late</Badge>}<span>{when(x.at)}</span></>} />
            ))}
          </Section>
          <Section icon={<MessageCircle className="size-4" />} title="Messages" count={d.data.messages.length} empty="No unread messages.">
            {d.data.messages.map((x: any) => (
              <Row key={`${x.itemId}-${x.studentId}`} href={review(x)} title={<>{x.name} <Badge tone="accent">{x.unread}</Badge></>} sub={`“${x.snippet}” · ${x.title}`} meta={<span>{when(x.at)}</span>} />
            ))}
          </Section>
          <Section icon={<HelpCircle className="size-4" />} title="Questions" count={d.data.questions.length} empty="No open questions.">
            {d.data.questions.map((x: any) => (
              <Row key={x.announcementId} href={`/teacher?class=${x.classId}&tab=stream`} title={`${x.last.name}: “${x.last.text}”`} sub={`Under “${x.announcement}” · ${x.className}`} meta={<>{x.count > 1 && <Badge>{x.count} questions</Badge>}<span>{when(x.last.at)}</span></>} />
            ))}
          </Section>
        </div>
      )}
    </>
  );
}

function Section({ icon, title, count, empty, children }: { icon: ReactNode; title: string; count: number; empty: string; children: ReactNode }) {
  return (
    <Card pad={false} title={<span className="inline-flex items-center gap-2">{icon}{title}{count > 0 && <span className="tabular-nums text-[var(--text-muted)]">{count}</span>}</span> as any}>
      {count ? <ul className="divide-y divide-[var(--border)]">{children}</ul> : <p className="px-5 pb-5 text-sm text-[var(--text-muted)]">{empty}</p>}
    </Card>
  );
}

function Row({ href, title, sub, meta }: { href: string; title: ReactNode; sub: string; meta: ReactNode }) {
  return (
    <li>
      <Link href={href} className="flex flex-col gap-1 px-5 py-3.5 transition-colors hover:bg-[var(--surface)]">
        <span className="text-sm font-medium [overflow-wrap:anywhere]">{title}</span>
        <span className="line-clamp-2 text-xs text-[var(--text-muted)]">{sub}</span>
        <span className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-muted)]">{meta}</span>
      </Link>
    </li>
  );
}
