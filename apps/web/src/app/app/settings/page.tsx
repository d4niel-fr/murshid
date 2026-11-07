'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Dialog as D } from 'radix-ui';
import { CreditCard, Database, Download, Eye, Keyboard, Languages, Link2, Loader2, MessageCircleHeart, Moon, RotateCcw, Shield, Smile, UserRound, Wifi } from 'lucide-react';
import { Mascot } from '@/components/mascot/mascot';
import { Input } from '@/components/ui/input';
import { billing, price, useBilling } from '@/lib/billing';
import { ApiError, newIdempotencyKey } from '@/lib/http';
import { cancelPlan } from '@/lib/school-api';
import { DEFAULT_MASCOT, MASCOT_COLORS, MASCOT_FACES, MASCOT_GLOWS, MASCOT_SHAPES, type MascotColor, type MascotFace, type MascotGlow, type MascotShape, type TextSize } from '@/lib/prefs';
import { eyeColour, MASCOT_FILL } from '@/components/mascot/mascot';
import { cn } from '@/lib/utils';
import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Bento, Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DialogContent } from '@/components/ui/dialog';
import { Segmented } from '@/components/ui/segmented';
import { Switch } from '@/components/ui/switch';
import { API_BASE, createClient } from '@/lib/api';
import { BANDS, BAND_IDS, demoStudents, type BandId } from '@/lib/bands';
import type { BuddyStatus } from '@/lib/types';
import { AccountCard } from '@/components/account/account-card';
import { NotificationsCard } from '@/components/account/notifications-card';

function Row({ title, desc, children }: { title: ReactNode; desc?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-border py-3.5 last:border-0">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        {desc && <p className="mt-0.5 text-xs text-muted-foreground">{desc}</p>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

const PRIVACY_KEY = 'murshid:privacy';
type Privacy = { shareDigest: boolean; analytics: boolean; publicProfile: boolean; personalisedOpps: boolean };
const DEFAULT_PRIVACY: Privacy = { shareDigest: true, analytics: false, publicProfile: false, personalisedOpps: true };

export default function SettingsPage() {
  const { prefs, setPrefs, tx, locale, band, bandConfig, toast, resetUser, apiStatus, reportSource, user, world, live } = useApp();
  const router = useRouter();
  const [privacy, setPrivacy] = useState<Privacy>(DEFAULT_PRIVACY);
  const [testing, setTesting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  useEffect(() => { try { const r = localStorage.getItem(PRIVACY_KEY); if (r) setPrivacy({ ...DEFAULT_PRIVACY, ...JSON.parse(r) }); } catch { /* ignore */ } }, []);
  const setP = (k: keyof Privacy, v: boolean) => {
    const next = { ...privacy, [k]: v };
    setPrivacy(next);
    try { localStorage.setItem(PRIVACY_KEY, JSON.stringify(next)); } catch { /* ignore */ }
    toast({ title: tx('Privacy setting saved', 'تم حفظ إعداد الخصوصية') });
  };
  const g = (bandConfig as unknown as { guardian?: { level: string; seesGrades: boolean; seesActivities: boolean; seesChatTranscripts: boolean; approvesProfileLinks: boolean } }).guardian;

  const test = async () => {
    setTesting(true);
    const r = await createClient({ band, mode: 'auto', timeoutMs: 8000 }).getDashboard();
    reportSource(r.source);
    setTesting(false);
    toast(r.source === 'api'
      ? { title: tx('Connected to the Murshid API', 'متصل بواجهة مرشد'), description: API_BASE }
      : { title: tx('API not reachable, using demo data', 'الواجهة غير متاحة، تُستخدم بيانات تجريبية'), description: API_BASE, tone: 'info' });
  };
  const exportData = () => {
    // everything Murshid keeps on this device: notes, decks, notebooks, focus sessions, saved items, drafts, preferences
    const device: Record<string, unknown> = {};
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k?.startsWith('murshid:') || k === 'murshid:admin-passcode') continue;
        const raw = localStorage.getItem(k) ?? '';
        try { device[k.slice('murshid:'.length)] = JSON.parse(raw); } catch { device[k.slice('murshid:'.length)] = raw; }
      }
    } catch { /* storage off: export what is in memory */ }
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), band, student: world.dashboard.student, localState: user, privacy, prefs, device }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `murshid-${band}-data.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: tx('Your data was downloaded', 'تم تنزيل بياناتك') });
  };

  return (
    <Page>
      <PageHeader title={tx('Settings & privacy', 'الإعدادات والخصوصية')} subtitle={tx('Everything here is stored on this device in the demo.', 'كل شيء هنا مخزّن على هذا الجهاز في النسخة التجريبية.')} />
      <Bento>
        <Card className="col-span-12 lg:col-span-6">
          <CardHeader title={tx('Appearance & language', 'المظهر واللغة')} icon={<Languages />} />
          <Row title={tx('Language', 'اللغة')} desc={tx('Arabic switches the whole app to right-to-left.', 'العربية تقلب التطبيق من اليمين إلى اليسار.')}>
            <Segmented value={prefs.locale} onChange={(v) => { setPrefs({ locale: v }); router.refresh(); }} options={[{ value: 'en', label: 'English' }, { value: 'ar', label: 'العربية' }]} />
          </Row>
          <Row title={tx('Theme', 'المظهر')}>
            <Segmented value={prefs.theme} onChange={(v) => setPrefs({ theme: v })} options={[{ value: 'light', label: tx('Light', 'فاتح') }, { value: 'dark', label: <span className="inline-flex items-center gap-1"><Moon className="size-3.5" />{tx('Dark', 'داكن')}</span> }]} />
          </Row>
          <Row title={tx('Sidebar', 'الشريط الجانبي')} desc={tx('Auto: icon rail on iPad, full on desktop. Shortcut ⌘B.', 'تلقائي: أيقونات على iPad وكامل على الكمبيوتر. اختصار ⌘B.')}>
            <Segmented size="sm" value={prefs.sidebar ?? 'auto'} onChange={(v) => setPrefs({ sidebar: v === 'auto' ? null : v })} options={[{ value: 'auto', label: tx('Auto', 'تلقائي') }, { value: 'expanded', label: tx('Open', 'مفتوح') }, { value: 'collapsed', label: tx('Rail', 'أيقونات') }]} />
          </Row>
          <Row title={tx('Show how Murshid worked it out', 'أظهر كيف توصّل مرشد إلى الإجابة')} desc={tx('Adds a small panel under replies and automatic updates with the steps, data and changes behind them.', 'يضيف لوحة صغيرة تحت الردود توضح الخطوات والبيانات والتغييرات.')}>
            <Switch checked={Boolean(prefs.showWorkings)} onCheckedChange={(v) => setPrefs({ showWorkings: v })} aria-label="show workings" />
          </Row>
          <Row title={tx('Text size', 'حجم النص')} desc={tx('Scales the whole app. Shortcut: + and −.', 'يغيّر حجم التطبيق كله. اختصار: + و−.')}>
            <Segmented size="sm" ariaLabel={tx('Text size', 'حجم النص')} value={prefs.textSize ?? 'md'} onChange={(v: TextSize) => setPrefs({ textSize: v })} options={[{ value: 'sm', label: 'A−' }, { value: 'md', label: 'A' }, { value: 'lg', label: 'A+' }, { value: 'xl', label: 'A++' }]} />
          </Row>
          <Row title={tx('Reduced motion', 'تقليل الحركة')} desc={tx('Murshid follows your device setting automatically.', 'يتبع مرشد إعداد جهازك تلقائياً.')}>
            <Badge tone="outline">{tx('System', 'النظام')}</Badge>
          </Row>
          <Row title={tx('Keyboard shortcuts', 'اختصارات لوحة المفاتيح')} desc={tx('Press ? anywhere in the app to see them all.', 'اضغط ? في أي مكان لعرضها كلها.')}>
            <Badge tone="outline"><Keyboard className="size-3" />?</Badge>
          </Row>
        </Card>

        <MascotCard />
        <PlanCard />

        <Card className="col-span-12 lg:col-span-6">
          <CardHeader title={tx('Demo student & grade band', 'الطالب التجريبي والمرحلة')} icon={<UserRound />} />
          <div className="grid gap-2">
            <button onClick={() => { const next = prefs.persona === 'demo-ideal' ? null : 'demo-ideal'; setPrefs({ persona: next, ...(next ? { band: 'g11-12' as BandId } : {}) }); router.refresh(); toast({ title: next ? tx('Now viewing Ahamed (full demo profile)', 'تعرض الآن أحمد (الشخصية الرئيسية)') : tx('Back to the band demo student', 'العودة إلى طالب المرحلة'), tone: 'info' }); }}
              className={prefs.persona === 'demo-ideal' ? 'flex min-w-0 items-center gap-3 rounded-[var(--radius)] bg-[var(--accent-soft)] p-3 text-start ring-1 ring-[color-mix(in_oklab,var(--accent)_45%,transparent)]' : 'flex min-w-0 items-center gap-3 rounded-[var(--radius)] p-3 text-start hover:bg-surface-2'}>
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-[var(--warning)] text-sm font-semibold text-white">A</span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{tx('Ahamed Mehta · full demo profile', 'أحمد ميهتا · الملف التجريبي الكامل')}</span><span className="block truncate text-xs text-muted-foreground">{tx('Grade 11 · school licence (demo) · football + swimming · uses the live demo server', 'الصف 11 · ترخيص مدرسي · كرة القدم والسباحة · يتطلب الواجهة الحية')}</span></span>
              {prefs.persona === 'demo-ideal' && <Badge tone="brand">{tx('Active', 'نشط')}</Badge>}
            </button>
            {BAND_IDS.map((b: BandId) => {
              const s = demoStudents[b];
              const on = b === band && !prefs.persona;
              return (
                <button key={b} onClick={() => { setPrefs({ band: b, persona: null }); router.refresh(); toast({ title: tx(`Now viewing ${s.firstName}`, `تعرض الآن ${s.nameAr}`), tone: 'info' }); }} data-band={b}
                  className={on ? 'flex min-w-0 items-center gap-3 rounded-[var(--radius)] bg-[var(--accent-soft)] p-3 text-start ring-1 ring-[color-mix(in_oklab,var(--accent)_45%,transparent)]' : 'flex min-w-0 items-center gap-3 rounded-[var(--radius)] p-3 text-start hover:bg-surface-2'}>
                  <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground">{s.firstName[0]}</span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-medium">{locale === 'ar' ? s.nameAr : `${s.firstName} ${s.lastName}`}</span><span className="block truncate text-xs text-muted-foreground">{BANDS[b].label[locale]} · {s.classLabel} · {s.school}</span></span>
                  {on && <Badge tone="brand">{tx('Active', 'نشط')}</Badge>}
                </button>
              );
            })}
          </div>
        </Card>

        {live && <AccountCard />}
        <NotificationsCard />
        <Card id="data" className="col-span-12 lg:col-span-6">
          <CardHeader title={tx('Data source', 'مصدر البيانات')} icon={<Database />} action={<Badge tone={apiStatus === 'up' ? 'success' : 'neutral'}>{apiStatus === 'up' ? <><Wifi className="size-3" />{tx('Live API', 'واجهة حية')}</> : tx('Demo data', 'بيانات تجريبية')}</Badge>} />
          <Row title={tx('Mode', 'الوضع')} desc={tx(`Auto tries ${API_BASE} first and falls back to bundled demo data.`, `التلقائي يجرب ${API_BASE} أولاً ثم البيانات المدمجة.`)}>
            <Segmented size="sm" value={prefs.dataMode} onChange={(v) => setPrefs({ dataMode: v })} options={[{ value: 'auto', label: tx('Auto', 'تلقائي') }, { value: 'mock', label: tx('Demo only', 'تجريبي فقط') }]} />
          </Row>
          <Row title={tx('Connection', 'الاتصال')} desc={tx('Checks GET /dashboard with the dev user header.', 'يفحص GET /dashboard.')}>
            <Button size="sm" variant="outline" onClick={test} disabled={testing}>{testing ? <Loader2 className="animate-spin" /> : <Wifi />}{tx('Test', 'اختبار')}</Button>
          </Row>
        </Card>

        <Card className="col-span-12 lg:col-span-6">
          <CardHeader title={tx('Privacy', 'الخصوصية')} icon={<Shield />} />
          <Row title={tx('Weekly digest to guardian', 'ملخص أسبوعي لولي الأمر')} desc={g ? tx(`Your band's guardian view: ${g.level}. Chats are ${g.seesChatTranscripts ? 'visible' : 'never shared'}.`, `عرض ولي الأمر لمرحلتك: ${g.level}. المحادثات ${g.seesChatTranscripts ? 'مرئية' : 'لا تُشارك أبداً'}.`) : undefined}>
            <Switch checked={privacy.shareDigest} onCheckedChange={(v) => setP('shareDigest', v)} aria-label={tx('Weekly digest to guardian', 'ملخص أسبوعي لولي الأمر')} />
          </Row>
          <Row title={tx('Personalised opportunities', 'فرص مخصصة')} desc={tx('Use your subjects and activities to rank opportunities.', 'استخدم موادك وأنشطتك لترتيب الفرص.')}>
            <Switch checked={privacy.personalisedOpps} onCheckedChange={(v) => setP('personalisedOpps', v)} aria-label={tx('Personalised opportunities', 'فرص مخصصة')} />
          </Row>
          <Row title={tx('Public profile', 'ملف عام')} desc={bandConfig.features.publicProfile ? tx('Let programmes view a read-only summary.', 'اسمح للبرامج برؤية ملخص للقراءة فقط.') : tx('Not available for your grade band.', 'غير متاح لمرحلتك.')}>
            <Switch checked={privacy.publicProfile && bandConfig.features.publicProfile} disabled={!bandConfig.features.publicProfile} onCheckedChange={(v) => setP('publicProfile', v)} aria-label={tx('Public profile', 'ملف عام')} />
          </Row>
          <Row title={tx('Anonymous usage analytics', 'إحصاءات استخدام مجهولة')} desc={tx('Counts which screens are used, never what you type or your name. Off by default; nothing is sent in this demo.', 'نحصي الشاشات المستخدمة فقط، لا ما تكتبه ولا اسمك. متوقف افتراضياً؛ لا يُرسل شيء في هذا العرض.')}>
            <Switch checked={privacy.analytics} onCheckedChange={(v) => setP('analytics', v)} aria-label={tx('Anonymous usage analytics', 'إحصاءات استخدام مجهولة')} />
          </Row>
        </Card>

        <BuddyCard />

        <Card className="col-span-12">
          <CardHeader title={tx('Your data', 'بياناتك')} icon={<Eye />} />
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={exportData}><Download />{tx('Download my data', 'تنزيل بياناتي')}</Button>
            <Button variant="outline" asChild><Link href="/app/profile"><Link2 />{tx('Manage connected profiles', 'إدارة الحسابات المرتبطة')}</Link></Button>
            <D.Root open={resetOpen} onOpenChange={setResetOpen}>
              <D.Trigger asChild><Button variant="ghost" className="text-[var(--danger)]"><RotateCcw />{tx('Reset demo data', 'إعادة تعيين البيانات')}</Button></D.Trigger>
              <DialogContent title={tx('Reset demo data?', 'إعادة تعيين البيانات؟')} description={tx('This clears ticked tasks, logged sessions, goals, applications and links you added on this device for all demo students.', 'سيمسح هذا المهام والجلسات والأهداف والطلبات والروابط التي أضفتها على هذا الجهاز لكل الطلاب التجريبيين.')}>
                <div className="flex justify-end gap-2">
                  <D.Close asChild><Button variant="ghost">{tx('Cancel', 'إلغاء')}</Button></D.Close>
                  <Button variant="danger" onClick={() => { resetUser(); setResetOpen(false); toast({ title: tx('Demo data reset', 'تمت إعادة التعيين') }); }}>{tx('Reset', 'إعادة تعيين')}</Button>
                </div>
              </DialogContent>
            </D.Root>
          </div>
        </Card>
      </Bento>
    </Page>
  );
}

/** Study buddy mode: what it is, whether it is on, and the guardian switch (demo; the school switch is in the admin portal / API). */
function BuddyCard() {
  const { tx, client, toast } = useApp();
  const [st, setSt] = useState<BuddyStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [askCode, setAskCode] = useState<boolean | null>(null);
  const [code, setCode] = useState('');
  useEffect(() => { let on = true; client.getBuddy().then((r) => { if (on) setSt(r.data); }); return () => { on = false; }; }, [client]);
  const guardianOn = st ? st.controls.guardian !== false && !(st.reason === 'needs_guardian') : false;
  const flip = async (v: boolean, passcode = readDemoPasscode()) => {
    setBusy(true);
    const r = await client.setBuddyGuardian(v, passcode);
    setBusy(false);
    if (r.needsPasscode) {
      // public demo: the guardian switch needs the demo passcode (the same one as the school portal)
      if (passcode) toast({ title: tx('Wrong passcode', 'رمز المرور غير صحيح'), tone: 'info' });
      saveDemoPasscode(null); setAskCode(v); return;
    }
    if (r.source !== 'api') { toast({ title: tx('Needs the Murshid server', 'يحتاج إلى خادم مرشد'), tone: 'info' }); return; }
    if (passcode) saveDemoPasscode(passcode);
    setAskCode(null); setCode('');
    setSt(r.data);
    toast({ title: v ? tx('Study buddy switched on by guardian', 'فعّل وليّ الأمر رفيق الدراسة') : tx('Study buddy switched off by guardian', 'أوقف وليّ الأمر رفيق الدراسة'), description: tx('Recorded in the audit log.', 'سُجّل في سجل التدقيق.'), tone: 'success' });
  };
  const state = !st ? tx('Checking…', 'جارٍ التحقق…')
    : st.reason === 'on' ? tx('Available', 'متاح')
    : st.reason === 'school_off' ? tx('Off (school)', 'متوقف (المدرسة)')
    : st.reason === 'guardian_off' ? tx('Off (guardian)', 'متوقف (وليّ الأمر)')
    : st.reason === 'needs_guardian' ? tx('Needs guardian', 'يحتاج وليّ الأمر')
    : tx('Offline', 'غير متصل');
  return (
    <Card className="col-span-12 lg:col-span-6">
      <CardHeader title={tx('Study buddy mode', 'وضع رفيق الدراسة')} icon={<MessageCircleHeart />} action={<Badge tone={st?.available ? 'success' : 'neutral'}>{state}</Badge>} />
      <p className="text-sm text-muted-foreground">{tx(
        'An optional, friendlier persona in chat. It always says it is an AI, never does romance or secrets, points you to real friends and trusted adults, and its jokes get gentler for younger grades. Safety flags (never your messages) are logged for your school.',
        'شخصية اختيارية أكثر ودّاً في المحادثة. تقول دائماً إنها ذكاء اصطناعي، ولا تتعامل مع الرومانسية أو الأسرار، وتوجّهك إلى أصدقاء حقيقيين وبالغين موثوقين. تُسجَّل إشارات الأمان فقط (لا رسائلك) لمدرستك.',
      )}</p>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius)] bg-surface-2 p-3">
        <span className="min-w-0"><span className="block text-sm font-medium">{tx('Parent / guardian switch (demo)', 'مفتاح وليّ الأمر (تجريبي)')}</span>
          <span className="block text-xs text-muted-foreground">{tx('Grades 5-6 start off until a guardian switches it on. The school can switch it off for everyone.', 'يبدأ الصفان 5-6 متوقفاً حتى يفعّله وليّ الأمر. ويمكن للمدرسة إيقافه للجميع.')}</span></span>
        <Switch checked={guardianOn} disabled={!st || st.reason === 'offline' || busy} onCheckedChange={(v) => void flip(v)} aria-label={tx('Guardian allows study buddy mode', 'يسمح وليّ الأمر بوضع رفيق الدراسة')} />
      </div>
      {askCode !== null && (
        <form className="mt-3 flex flex-wrap items-center gap-2" onSubmit={(e) => { e.preventDefault(); if (code.trim()) void flip(askCode, code.trim()); }}>
          <span className="w-full text-xs text-muted-foreground">{tx('On the public demo, only a guardian or the school can change this. Enter the demo passcode.', 'في العرض التجريبي العام، يمكن لوليّ الأمر أو المدرسة فقط تغيير هذا. أدخل رمز المرور التجريبي.')}</span>
          <input type="password" value={code} onChange={(e) => setCode(e.target.value)} autoFocus aria-label={tx('Demo passcode', 'رمز المرور التجريبي')} placeholder={tx('Passcode', 'رمز المرور')}
            className="h-10 min-w-0 flex-1 rounded-full border border-border bg-field px-4 text-sm outline-none focus:border-[var(--brand-light)]" />
          <Button type="submit" size="sm" disabled={!code.trim() || busy}>{tx('Confirm', 'تأكيد')}</Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => { setAskCode(null); setCode(''); }}>{tx('Cancel', 'إلغاء')}</Button>
        </form>
      )}
    </Card>
  );
}

/** Demo passcode for the guardian switch, kept in this browser only (same key as the school portal). */
const DEMO_PASSCODE_KEY = 'murshid:admin-passcode';
function readDemoPasscode(): string | null {
  try { return localStorage.getItem(DEMO_PASSCODE_KEY); } catch { return null; }
}
function saveDemoPasscode(code: string | null) {
  try { if (code) localStorage.setItem(DEMO_PASSCODE_KEY, code); else localStorage.removeItem(DEMO_PASSCODE_KEY); } catch { /* private mode */ }
}

/** The Murshid bot, shaped by the student (head, eyes, colours), plus companion mode. */
function MascotCard() {
  const { prefs, setPrefs, tx } = useApp();
  const m = prefs.mascot ?? DEFAULT_MASCOT;
  const set = (patch: Partial<typeof m>) => setPrefs({ mascot: { ...m, ...patch } });
  const SHAPE: Record<MascotShape, string> = { orb: tx('Orb', 'كرة'), pebble: tx('Pebble', 'حصاة'), cube: tx('Cube', 'مكعب'), capsule: tx('Capsule', 'كبسولة') };
  const FACE: Record<MascotFace, string> = { tall: tx('Tall', 'طويلة'), round: tx('Round', 'دائرية'), wide: tx('Wide', 'عريضة'), mono: tx('Single', 'واحدة') };
  const COL: Record<MascotColor, string> = { royal: tx('Murshid blue', 'أزرق مرشد'), navy: tx('Navy', 'كحلي'), sky: tx('Sky', 'سماوي'), teal: tx('Teal', 'تركوازي'), violet: tx('Violet', 'بنفسجي'), coral: tx('Coral', 'مرجاني'), lime: tx('Lime', 'ليموني'), graphite: tx('Graphite', 'رمادي داكن') };
  const GLOW: Record<MascotGlow, string> = { auto: tx('Auto', 'تلقائي'), ink: tx('Ink', 'حبر'), white: tx('White', 'أبيض'), sky: tx('Ice blue', 'أزرق ثلجي'), lime: tx('Lime', 'ليموني') };
  const label = 'mb-2 block text-[0.6875rem] font-medium uppercase tracking-[0.18em] text-muted-foreground rtl:tracking-normal';
  const swatch = (on: boolean) => cn('size-10 rounded-full ring-offset-2 ring-offset-[var(--surface)] transition-shadow duration-150 hover:ring-2 hover:ring-[var(--border)] active:scale-[0.95] sm:size-9', on && 'ring-2 ring-[var(--text)]');
  const tile = (on: boolean) => cn('flex min-w-0 flex-col items-center gap-1 rounded-2xl border px-1 py-2 text-[0.75rem] font-medium transition-colors active:scale-[0.98]', on ? 'border-[var(--deep)] bg-[color-mix(in_oklab,var(--deep)_6%,transparent)] text-foreground' : 'border-[var(--border)] text-muted-foreground hover:bg-surface');
  return (
    <Card id="mascot" className="col-span-12 scroll-mt-24 lg:col-span-6">
      <CardHeader title={tx('Your Murshid', 'مرشد الخاص بك')} icon={<Smile />} />
      <div className="flex flex-col items-center gap-5">
        <div className="grid h-44 w-full max-w-[20rem] shrink-0 place-items-center rounded-[28px] bg-surface"><Mascot size={140} shape={m.shape} face={m.face} color={m.color} glow={m.glow} mood="happy" /></div>
        <div className="flex w-full min-w-0 flex-col gap-4">
          <div>
            <p className={label}>{tx('Shape', 'الشكل')}</p>
            <div role="radiogroup" aria-label={tx('Shape', 'الشكل')} className="grid grid-cols-4 gap-2">
              {MASCOT_SHAPES.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={m.shape === k} onClick={() => set({ shape: k })} className={tile(m.shape === k)}>
                  <span aria-hidden><Mascot size={44} shape={k} face={m.face} color={m.color} glow={m.glow} track={false} grounded={false} /></span>{SHAPE[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={label}>{tx('Eyes', 'العينان')}</p>
            <div role="radiogroup" aria-label={tx('Eyes', 'العينان')} className="grid grid-cols-4 gap-2">
              {MASCOT_FACES.map((k) => (
                <button key={k} type="button" role="radio" aria-checked={m.face === k} onClick={() => set({ face: k })} className={tile(m.face === k)}>
                  <span aria-hidden><Mascot size={44} shape={m.shape} face={k} color={m.color} glow={m.glow} track={false} grounded={false} /></span>{FACE[k]}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className={label}>{tx('Colour', 'اللون')}</p>
            <div role="radiogroup" aria-label={tx('Body colour', 'لون الجسم')} className="flex flex-wrap gap-2">
              {MASCOT_COLORS.map((c) => <button key={c} type="button" role="radio" aria-checked={m.color === c} aria-label={COL[c]} title={COL[c]} onClick={() => set({ color: c })} className={swatch(m.color === c)} style={{ background: MASCOT_FILL[c] }} />)}
            </div>
          </div>
          <div>
            <p className={label}>{tx('Eye colour', 'لون العينين')}</p>
            <div role="radiogroup" aria-label={tx('Eye colour', 'لون العينين')} className="flex flex-wrap gap-2">
              {MASCOT_GLOWS.map((c) => <button key={c} type="button" role="radio" aria-checked={m.glow === c} aria-label={GLOW[c]} title={GLOW[c]} onClick={() => set({ glow: c })} className={cn(swatch(m.glow === c), 'grid place-items-center')} style={{ background: MASCOT_FILL[m.color] }}>
                {/* each swatch shows the eyes as they will be drawn on this body (Auto: ink, or white on dark bodies) */}
                <span className="flex gap-[3px]" aria-hidden><span className="h-3.5 w-[5px] rounded-full" style={{ background: eyeColour(c, MASCOT_FILL[m.color]) }} /><span className="h-3.5 w-[5px] rounded-full" style={{ background: eyeColour(c, MASCOT_FILL[m.color]) }} /></span>
                {c === 'auto' && <span className="sr-only">{tx('Picks dark or white eyes for the colour', 'يختار عينين داكنتين أو بيضاوين حسب اللون')}</span>}
              </button>)}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4">
        <Row title={tx('Companion mode', 'وضع الرفيق')} desc={tx('Murshid answers beside the chat in Ask Murshid.', 'يجيبك مرشد بجانب المحادثة في «اسأل مرشد».')}><Switch checked={Boolean(prefs.companion)} onCheckedChange={(v) => setPrefs({ companion: v })} aria-label={tx('Companion mode', 'وضع الرفيق')} /></Row>
        <Row title={tx('Read replies aloud', 'قراءة الردود بصوت عالٍ')} desc={tx('Uses your browser’s voice. Nothing is recorded.', 'يستخدم صوت متصفحك. لا يُسجّل شيء.')}><Switch checked={Boolean(prefs.voice)} onCheckedChange={(v) => setPrefs({ voice: v })} aria-label={tx('Read replies aloud', 'قراءة الردود بصوت عالٍ')} /></Row>
      </div>
    </Card>
  );
}

/** Two-step cancel: confirm, tell the server (safe to retry), then update this device. */
function CancelPlan({ orderId, email, until }: { orderId: string; email: string; until: string }) {
  const { tx, toast } = useApp();
  const [step, setStep] = useState<'idle' | 'confirm' | 'busy'>('idle');
  const [key] = useState(() => newIdempotencyKey());
  const go = async () => {
    setStep('busy');
    try { await cancelPlan(orderId, email, key); } catch (e) {
      const err = e as ApiError;
      // a demo order made while the API was offline only exists on this device; anything else is a real failure
      if (!(orderId.startsWith('DEMO-') && err.transient)) { toast({ title: tx('Could not cancel', 'تعذّر الإلغاء'), description: err.message, tone: 'danger' }); setStep('confirm'); return; }
    }
    billing.cancel();
    toast({ title: tx('Plan cancelled', 'أُلغيت الخطة'), description: tx(`You keep access until ${until}.`, `يبقى وصولك حتى ${until}.`), tone: 'info' });
    setStep('idle');
  };
  if (step === 'idle') return <Button variant="secondary" onClick={() => setStep('confirm')}>{tx('Cancel plan', 'إلغاء الخطة')}</Button>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2" role="group" aria-label={tx('Confirm cancelling', 'تأكيد الإلغاء')}>
      <Button variant="danger" onClick={go} disabled={step === 'busy'} aria-busy={step === 'busy'}>{step === 'busy' ? <Loader2 className="size-4 animate-spin" /> : null}{tx('Yes, cancel', 'نعم، ألغِ')}</Button>
      <Button variant="ghost" onClick={() => setStep('idle')} disabled={step === 'busy'}>{tx('Keep my plan', 'أبقِ خطتي')}</Button>
    </span>
  );
}

/** Plan: the Single plan (bought online) or the school licence, which the school arranges. */
function PlanCard() {
  const { tx, locale, toast } = useApp();
  const { sub } = useBilling();
  const date = (t: number) => new Date(t).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  return (
    <Card id="plan" className="col-span-12 scroll-mt-24 lg:col-span-6">
      <CardHeader title={tx('Plan', 'الخطة')} icon={<CreditCard />} action={<Badge tone={sub?.status === 'active' ? 'success' : 'neutral'}>{sub ? (sub.status === 'active' ? tx('Active', 'نشطة') : tx('Ends soon', 'تنتهي قريباً')) : tx('Demo', 'تجريبي')}</Badge>} />
      {sub ? (
        <>
          <Row title={tx('Single plan', 'الخطة الفردية')} desc={tx(`${sub.billing === 'monthly' ? 'Monthly' : 'Yearly'} · AED ${price(sub.billing)} · ${sub.email}`, `${sub.billing === 'monthly' ? 'شهري' : 'سنوي'} · ${price(sub.billing)} درهم · ${sub.email}`)}><span className="text-xs tabular text-muted-foreground">#{sub.orderId}</span></Row>
          <Row title={sub.status === 'active' ? tx('Renews on', 'يتجدد في') : tx('Access until', 'الوصول حتى')} desc={sub.status === 'active' ? tx('Cancel any time; you keep access until then.', 'ألغِ في أي وقت؛ يبقى وصولك حتى ذلك الحين.') : tx('Your plan will not renew.', 'لن تتجدد خطتك.')}><span className="text-sm">{date(sub.renewsAt)}</span></Row>
          <div className="mt-4 flex flex-wrap gap-2">
            {sub.status === 'active'
              ? <CancelPlan orderId={sub.orderId} email={sub.email} until={date(sub.renewsAt)} />
              : <Button onClick={() => { billing.resume(); toast({ title: tx('Plan resumed', 'استؤنفت الخطة') }); }}>{tx('Resume plan', 'استئناف الخطة')}</Button>}
            <Button variant="ghost" asChild><Link href="/pricing">{tx('Compare plans', 'قارن الخطط')}</Link></Button>
          </div>
        </>
      ) : (
        <>
          <p className="text-sm leading-relaxed text-muted-foreground">{tx('You are using the free demo. The Single plan unlocks Murshid for one student: planning, study tools, applications and CV. School licences are arranged with your school.', 'أنت تستخدم العرض التجريبي المجاني. تفتح الخطة الفردية مرشد لطالب واحد: التخطيط وأدوات الدراسة والطلبات والسيرة الذاتية. وتُرتّب تراخيص المدارس مع مدرستك.')}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild><Link href="/checkout?plan=single&billing=yearly">{tx(`Get Single · AED ${price('monthly')}/month`, `احصل على الفردية · ${price('monthly')} درهم/شهر`)}</Link></Button>
            <Button variant="ghost" asChild><Link href="/pricing">{tx('See plans', 'عرض الخطط')}</Link></Button>
          </div>
        </>
      )}
    </Card>
  );
}
