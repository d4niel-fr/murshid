'use client';

import { Bell, BellOff, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { disablePush, enablePush, getInbox, pushOn, pushSupported, setEmail, type Inbox } from '@/lib/notify';

/** Settings → Notifications: push on this device, and email. */
export function NotificationsCard() {
  const { tx, client, toast, live } = useApp();
  const [inbox, setInbox] = useState<Inbox | null>(null);
  const [push, setPush] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => { void getInbox(client.devUser).then(setInbox).catch(() => undefined); void pushOn().then(setPush); }, [client.devUser]);
  const key = inbox?.pushKey ?? process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY ?? null;
  const togglePush = async () => {
    setBusy(true);
    try {
      if (push) { await disablePush(client.devUser); setPush(false); return; }
      const why = key ? await enablePush(key, client.devUser) : 'unsupported';
      if (!why) { setPush(true); toast({ title: tx('Notifications are on for this device', 'الإشعارات مفعّلة على هذا الجهاز') }); }
      else toast({ tone: 'danger', title: why === 'denied' ? tx('Notifications are blocked: allow them for this site in your browser settings.', 'الإشعارات محظورة: اسمح بها لهذا الموقع من إعدادات المتصفح.') : why === 'unsupported' ? tx('This device or browser can’t get notifications from Murshid. On iPhone and iPad, add Murshid to the Home Screen first.', 'هذا الجهاز أو المتصفح لا يستقبل إشعارات مرشد. على iPhone وiPad أضف مرشد إلى الشاشة الرئيسية أولاً.') : tx('Could not turn notifications on. Try again.', 'تعذّر تفعيل الإشعارات. حاول مرة أخرى.') });
    } finally { setBusy(false); }
  };
  const toggleEmail = async (on: boolean) => {
    try { await setEmail(on); setInbox((i) => (i ? { ...i, email: { ...i.email, on } } : i)); } catch (e) { toast({ tone: 'danger', title: (e as Error).message }); }
  };
  return (
    <section id="notifications" className="card col-span-12 scroll-mt-24 p-5 lg:col-span-6">
      <h2 className="card-title mb-1">{tx('Notifications', 'الإشعارات')}</h2>
      <p className="mb-4 text-sm text-muted-foreground">{tx('New work, marks, messages from teachers and reminders the day before something is due. Never during school hours or at night.', 'الأعمال الجديدة والدرجات ورسائل المعلمين وتذكير قبل يوم من الموعد. لا شيء خلال الدوام المدرسي أو في الليل.')}</p>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <div><p className="text-sm font-medium">{tx('On this device', 'على هذا الجهاز')}</p><p className="text-xs text-muted-foreground">{!pushSupported() ? tx('Not available in this browser.', 'غير متاح في هذا المتصفح.') : !key ? tx('Not switched on for this Murshid yet.', 'لم تُفعَّل بعد لهذا الإصدار من مرشد.') : push ? tx('On', 'مفعّلة') : tx('Off', 'متوقفة')}</p></div>
          <Button size="sm" variant="secondary" onClick={() => void togglePush()} disabled={busy || !pushSupported() || !key}>{push ? <BellOff /> : <Bell />}{push ? tx('Turn off', 'إيقاف') : tx('Turn on', 'تفعيل')}</Button>
        </div>
        {live && (
          <div className="flex items-center justify-between gap-3">
            <div><p className="flex items-center gap-1.5 text-sm font-medium"><Mail className="size-4" />{tx('By email', 'بالبريد')}</p><p className="text-xs text-muted-foreground" dir="auto">{inbox?.email.address ?? '—'}{inbox && !inbox.channels.email ? ` · ${tx('email is not set up yet', 'البريد غير مُعدّ بعد')}` : ''}</p></div>
            <Switch checked={Boolean(inbox?.email.on)} onCheckedChange={(v) => void toggleEmail(v)} disabled={!inbox?.email.address} aria-label={tx('Email notifications', 'إشعارات البريد')} />
          </div>
        )}
      </div>
    </section>
  );
}
