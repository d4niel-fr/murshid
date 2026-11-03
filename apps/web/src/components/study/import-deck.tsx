'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Layers } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Page, PageHeader } from '@/components/shared/page';
import { EmptyState } from '@/components/shared/states';
import { Button } from '@/components/ui/button';
import { count } from '@/lib/plural';
import { study, SUBJECTS } from '@/lib/study';
import { readShareLink } from '@/lib/study-ai';

/** Opens a shared deck link (the cards are inside the link) and adds a copy to this student's decks. */
export function ImportDeckView() {
  const { tx, toast } = useApp();
  const router = useRouter();
  const [deck, setDeck] = useState<ReturnType<typeof readShareLink> | undefined>(undefined);
  useEffect(() => { setDeck(readShareLink(window.location.hash)); }, []);
  if (deck === undefined) return <Page><span /></Page>;
  if (!deck || !deck.cards.length) {
    return <Page><EmptyState title={tx('This link has no deck in it', 'لا يحتوي هذا الرابط على مجموعة')} action={<Button asChild><Link href="/app/study/flashcards">{tx('My decks', 'مجموعاتي')}</Link></Button>}>{tx('Ask for the link again: it may have been cut short when it was copied.', 'اطلب الرابط مجدداً: ربما قُطع عند نسخه.')}</EmptyState></Page>;
  }
  const add = () => {
    const id = study.createDeck(deck.title, SUBJECTS.includes(deck.subject) ? deck.subject : 'Other', deck.cards, tx('Shared with you', 'شاركها أحدهم معك'));
    toast({ title: tx('Deck added', 'أُضيفت المجموعة'), tone: 'success' });
    router.push(`/app/study/flashcards/${id}`);
  };
  return (
    <Page>
      <PageHeader eyebrow={tx('Shared deck', 'مجموعة مشتركة')} title={deck.title} subtitle={`${deck.subject} · ${tx(count(deck.cards.length, 'card'), `${deck.cards.length} بطاقة`)}`}
        actions={<Button onClick={add}><Layers />{tx('Add to my decks', 'أضف إلى مجموعاتي')}</Button>} />
      <ol className="grid gap-2 md:grid-cols-2">
        {deck.cards.slice(0, 40).map((c, i) => <li key={i} className="card p-4 text-sm"><p dir="auto" className="font-medium">{c.front}</p><p dir="auto" className="mt-1 text-muted-foreground">{c.back}</p></li>)}
      </ol>
      {deck.cards.length > 40 && <p className="mt-3 text-sm text-muted-foreground">{tx(`and ${deck.cards.length - 40} more`, `و${deck.cards.length - 40} أخرى`)}</p>}
    </Page>
  );
}
