'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { AlertCircle, Check, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { MyMascot } from '@/components/mascot/my-mascot';
import { Brand, Eyebrow } from '@/components/marketing/chrome';
import { Button } from '@/components/ui/button';
import { Input, Label, Select } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { billing as billingStore, price, useBilling, yearlySaving, type Billing } from '@/lib/billing';
import { ApiError, newIdempotencyKey } from '@/lib/http';
import { checkout } from '@/lib/school-api';
import { useAutosave } from '@/lib/use-autosave';
import { cn } from '@/lib/utils';

interface Draft { who: 'parent' | 'student'; name: string; email: string; studentName: string; grade: string; billing: Billing; agree: boolean }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function strength(p: string) {
  let n = 0; if (p.length >= 8) n++; if (p.length >= 12) n++; if (/[A-Z]/.test(p) && /[a-z]/.test(p)) n++; if (/\d/.test(p)) n++; if (/[^A-Za-z0-9]/.test(p)) n++;
  return Math.min(4, n);
}

/** The Single plan checkout (the only plan sold online). Demo: no payment details are asked for or taken. */
export function CheckoutView() {
  const { tx, toast } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const { sub } = useBilling();
  const initialBilling: Billing = params.get('billing') === 'monthly' ? 'monthly' : 'yearly';
  const draft = useAutosave<Draft>('checkout', { who: 'parent', name: '', email: '', studentName: '', grade: '10', billing: initialBilling, agree: false });
  const d = draft.value;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => draft.setValue({ ...d, [k]: v });
  const [password, setPassword] = useState(''); const [confirm, setConfirm] = useState('');
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const key = useRef(newIdempotencyKey());     // one key per checkout attempt: a double-click or retry can't buy twice
  const school = params.get('plan') === 'school';

  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (d.name.trim().length < 2) e.name = tx('Enter your full name.', 'أدخل اسمك الكامل.');
    if (!EMAIL.test(d.email.trim())) e.email = tx('Enter an email like name@example.com.', 'أدخل بريداً مثل name@example.com.');
    if (d.who === 'parent' && d.studentName.trim().length < 2) e.studentName = tx('Enter your child’s name.', 'أدخل اسم طفلك.');
    if (password.length < 8) e.password = tx('Use at least 8 characters.', 'استخدم 8 أحرف على الأقل.');
    if (confirm !== password) e.confirm = tx('The passwords don’t match.', 'كلمتا المرور غير متطابقتين.');
    if (!d.agree) e.agree = tx('Please accept the terms to continue.', 'يرجى قبول الشروط للمتابعة.');
    return e;
  }, [d, password, confirm, tx]);
  const show = (k: string) => touched[k] && errors[k];
  const s = strength(password);

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    setTouched({ name: true, email: true, studentName: true, password: true, confirm: true, agree: true });
    if (busy || Object.keys(errors).length) { const first = Object.keys(errors)[0]; if (first) document.getElementById(`co-${first}`)?.focus(); return; }
    setBusy(true); setError(null);
    const body = { plan: 'single' as const, billing: d.billing, name: d.name.trim(), email: d.email.trim().toLowerCase(), who: d.who, studentName: d.who === 'parent' ? d.studentName.trim() : undefined, grade: Number(d.grade) };
    let orderId: string;
    try {
      orderId = (await checkout(body, key.current)).orderId;
    } catch (e) {
      const err = e as ApiError;
      if (err.code === 'already_subscribed') {
        setError(tx('This email already has an active Single plan. Sign in with it, or use another email. To change billing, cancel the current plan in Settings first.', 'هذا البريد لديه خطة فردية نشطة. سجّل الدخول به أو استخدم بريداً آخر. لتغيير الفوترة، ألغِ الخطة الحالية من الإعدادات أولاً.'));
        setBusy(false); document.getElementById('co-email')?.focus(); return;
      }
      if (err.code === 'school_plan_offline') { router.push('/pricing#school-h'); return; }
      if (err.code === 'rate_limited') { setError(tx(`Too many tries. Wait ${err.retryAfter ?? 30} seconds and try again.`, `محاولات كثيرة. انتظر ${err.retryAfter ?? 30} ثانية ثم حاول مجدداً.`)); setBusy(false); return; }
      if (err.status && !err.transient) { setError(err.message); setBusy(false); return; }
      // the demo API is offline: finish on this device so the demo still works end to end
      orderId = `DEMO-${key.current.slice(0, 8).toUpperCase()}`;
    }
    billingStore.activate({ plan: 'single', billing: d.billing, email: body.email, name: body.name, orderId });
    draft.clear();
    toast({ title: tx('You’re all set', 'تم الأمر'), description: tx('Your Single plan is active.', 'خطتك الفردية نشطة.') });
    router.push(`/checkout/success?order=${encodeURIComponent(orderId)}`);
  };

  if (school) {
    return (
      <Shell>
        <div className="mx-auto max-w-lg py-16 text-center">
          <span className="text-[var(--deep)]"><MyMascot size={96} mood="thinking" /></span>
          <h1 className="mk-h2 mt-6 text-[2.5rem]">{tx('School plans aren’t sold online', 'لا تُباع خطط المدارس عبر الإنترنت')}</h1>
          <p className="mt-4 text-[1rem] leading-relaxed text-[var(--text-muted)]">{tx('A school licence needs the school’s approval and a Microsoft 365 connection, so we set it up with the school directly. Tell us what your school needs and we’ll be in touch.', 'يحتاج ترخيص المدرسة إلى موافقتها وربط Microsoft 365، لذلك نجهّزه مع المدرسة مباشرة. أخبرنا بما تحتاجه مدرستك وسنتواصل معك.')}</p>
          <div className="mt-8 flex justify-center gap-2"><Button asChild><Link href="/survey">{tx('Tell us about your school', 'أخبرنا عن مدرستك')}</Link></Button><Button variant="secondary" asChild><Link href="/checkout?plan=single">{tx('Buy Single instead', 'اشترِ الفردية بدلاً من ذلك')}</Link></Button></div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <div className="grid gap-10 py-10 lg:grid-cols-[1fr_24rem]">
        <form onSubmit={submit} noValidate className="order-2 rounded-[2rem] bg-[var(--surface)] p-6 sm:p-8 lg:order-1" aria-describedby="co-status">
          <Eyebrow>{tx('Step 1 of 1 · your account', 'الخطوة 1 من 1 · حسابك')}</Eyebrow>
          <h1 className="mk-h2 mt-4 text-[2.5rem] sm:text-[3rem]">{tx('Get Murshid Single', 'احصل على مرشد الفردية')}</h1>
          {sub?.status === 'active' && <p className="mt-4 rounded-[18px] tint-info px-4 py-3 text-sm">{tx('You already have an active Single plan on this device. Buying again replaces it.', 'لديك خطة فردية نشطة على هذا الجهاز. الشراء مجدداً يستبدلها.')}</p>}
          {draft.status === 'restored' && <p className="mt-4 text-[0.8125rem] text-[var(--text-muted)]">{tx('We restored what you typed last time (but never your password).', 'استعدنا ما كتبته سابقاً (دون كلمة المرور أبداً).')}</p>}

          <fieldset className="mt-8">
            <legend className="mb-3 text-sm font-medium">{tx('Who is it for?', 'لمن هو؟')}</legend>
            <div role="radiogroup" className="grid grid-cols-2 gap-2">
              {(['parent', 'student'] as const).map((w) => (
                <button key={w} type="button" role="radio" aria-checked={d.who === w} onClick={() => set('who', w)}
                  className={cn('rounded-[18px] border px-4 py-3 text-start transition-colors', d.who === w ? 'border-[var(--deep)] bg-[var(--deep)] text-white' : 'border-[var(--border)] hover:border-[var(--text)]')}>
                  <span className="block text-[0.9375rem] font-medium">{w === 'parent' ? tx('My child', 'طفلي') : tx('Myself', 'نفسي')}</span>
                  <span className={cn('text-xs', d.who === w ? 'text-white/70' : 'text-[var(--text-muted)]')}>{w === 'parent' ? tx('I’m a parent or guardian', 'أنا وليّ أمر') : tx('I’m the student', 'أنا الطالب')}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="co-name">{d.who === 'parent' ? tx('Your full name', 'اسمك الكامل') : tx('Full name', 'الاسم الكامل')}</Label>
              <Input id="co-name" autoComplete="name" value={d.name} onChange={(e) => set('name', e.target.value)} onBlur={() => setTouched({ ...touched, name: true })} aria-invalid={Boolean(show('name'))} aria-describedby={show('name') ? 'co-name-err' : undefined} />
              {show('name') && <p id="co-name-err" className="mt-1.5 flex items-center gap-1 text-xs text-[var(--danger)]"><AlertCircle className="size-3.5" />{errors.name}</p>}
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="co-email">{tx('Email', 'البريد الإلكتروني')}</Label>
              <Input id="co-email" type="email" inputMode="email" autoComplete="email" value={d.email} onChange={(e) => set('email', e.target.value)} onBlur={() => setTouched({ ...touched, email: true })} aria-invalid={Boolean(show('email'))} aria-describedby={show('email') ? 'co-email-err' : 'co-email-hint'} />
              {show('email') ? <p id="co-email-err" className="mt-1.5 flex items-center gap-1 text-xs text-[var(--danger)]"><AlertCircle className="size-3.5" />{errors.email}</p> : <p id="co-email-hint" className="mt-1.5 text-xs text-[var(--text-muted)]">{tx('For your receipt and sign-in.', 'للإيصال وتسجيل الدخول.')}</p>}
            </div>
            {d.who === 'parent' && (
              <div>
                <Label htmlFor="co-studentName">{tx('Your child’s name', 'اسم طفلك')}</Label>
                <Input id="co-studentName" value={d.studentName} onChange={(e) => set('studentName', e.target.value)} onBlur={() => setTouched({ ...touched, studentName: true })} aria-invalid={Boolean(show('studentName'))} />
                {show('studentName') && <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--danger)]"><AlertCircle className="size-3.5" />{errors.studentName}</p>}
              </div>
            )}
            <div>
              <Label htmlFor="co-grade">{tx('Grade', 'الصف')}</Label>
              <Select id="co-grade" value={d.grade} onChange={(e) => set('grade', e.target.value)}>{Array.from({ length: 8 }, (_, i) => i + 5).map((g) => <option key={g} value={g}>{tx(`Grade ${g}`, `الصف ${g}`)}</option>)}</Select>
            </div>
            <div>
              <Label htmlFor="co-password">{tx('Password', 'كلمة المرور')}</Label>
              <PasswordInput id="co-password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched({ ...touched, password: true })} aria-invalid={Boolean(show('password'))} aria-describedby="co-pw-meter" />
              <div id="co-pw-meter" className="mt-2" aria-live="polite">
                <div className="flex gap-1" aria-hidden>{[0, 1, 2, 3].map((i) => <span key={i} className={cn('h-1 flex-1 rounded-full', i < s ? (s <= 1 ? 'bg-[var(--danger)]' : s === 2 ? 'bg-[var(--warning)]' : 'bg-[var(--success)]') : 'bg-[var(--border)]')} />)}</div>
                <p className="mt-1 text-xs text-[var(--text-muted)]">{show('password') ? errors.password : password ? [tx('Too short', 'قصيرة جداً'), tx('Weak', 'ضعيفة'), tx('Fair', 'مقبولة'), tx('Good', 'جيدة'), tx('Strong', 'قوية')][s] : tx('8 characters or more; a phrase is easiest to remember.', '8 أحرف أو أكثر؛ العبارة أسهل للتذكر.')}</p>
              </div>
            </div>
            <div>
              <Label htmlFor="co-confirm">{tx('Confirm password', 'تأكيد كلمة المرور')}</Label>
              <PasswordInput id="co-confirm" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} onBlur={() => setTouched({ ...touched, confirm: true })} aria-invalid={Boolean(show('confirm'))} />
              {show('confirm') && <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--danger)]"><AlertCircle className="size-3.5" />{errors.confirm}</p>}
            </div>
          </div>

          <div className="mt-6 rounded-[20px] bg-[var(--bg)] p-5">
            <p className="flex items-center gap-2 text-sm font-medium"><Lock className="size-4" />{tx('Payment', 'الدفع')}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-[var(--text-muted)]">{tx('This is a demo, so no card details are asked for and nothing is charged. In the live product this step opens a secure payment page from our payment provider.', 'هذا عرض تجريبي، لذا لا تُطلب بيانات بطاقة ولا يُخصم شيء. في المنتج الفعلي تفتح هذه الخطوة صفحة دفع آمنة من مزوّد الدفع.')}</p>
          </div>

          <label className="mt-6 flex items-start gap-3 text-sm">
            <input id="co-agree" type="checkbox" checked={d.agree} onChange={(e) => set('agree', e.target.checked)} className="mt-0.5 size-4 accent-[var(--brand)]" aria-invalid={Boolean(show('agree'))} />
            <span>{tx('I agree to the terms and the ', 'أوافق على الشروط و')}<Link href="/privacy" className="underline underline-offset-2">{tx('privacy notice', 'إشعار الخصوصية')}</Link>{d.who === 'parent' ? tx(', and I’m the student’s parent or guardian.', '، وأنا وليّ أمر الطالب.') : tx(', and I’m 13 or older (under 18s need a guardian to confirm).', '، وعمري 13 عاماً أو أكثر (من هم دون 18 يحتاجون تأكيد وليّ الأمر).')}</span>
          </label>
          {show('agree') && <p className="mt-1.5 text-xs text-[var(--danger)]">{errors.agree}</p>}

          {error && <p role="alert" className="mt-6 flex items-start gap-2 rounded-[18px] tint-danger px-4 py-3 text-sm"><AlertCircle className="mt-0.5 size-4 shrink-0" />{error}</p>}
          <div id="co-status" className="mt-8 flex flex-wrap items-center gap-4">
            <Button type="submit" size="lg" disabled={busy} aria-busy={busy} data-testid="checkout-submit">
              {busy ? <><Loader2 className="animate-spin" />{tx('Setting up your plan…', 'جارٍ تجهيز خطتك…')}</> : tx(`Start Single · AED ${price(d.billing)}`, `ابدأ الفردية · ${price(d.billing)} درهم`)}
            </Button>
            <span className="text-xs text-[var(--text-muted)]" aria-live="polite">{draft.status === 'saved' ? tx('Draft saved on this device', 'حُفظت المسودة على هذا الجهاز') : ''}</span>
          </div>
        </form>

        <aside className="order-1 lg:order-2" aria-label={tx('Order summary', 'ملخص الطلب')}>
          <div className="on-deep sticky top-6 rounded-[2rem] bg-[var(--deep)] p-6 text-white">
            <Eyebrow tone="light">{tx('Your plan', 'خطتك')}</Eyebrow>
            <p className="mt-3 text-[1.75rem] font-medium">{tx('Single', 'الفردية')}</p>
            <div role="radiogroup" aria-label={tx('Billing period', 'فترة الدفع')} className="mt-4 grid grid-cols-2 gap-1 rounded-full bg-white/10 p-1">
              {(['monthly', 'yearly'] as Billing[]).map((b) => <button key={b} type="button" role="radio" aria-checked={d.billing === b} onClick={() => set('billing', b)} className={cn('rounded-full py-2 text-[0.8125rem] font-medium', d.billing === b ? 'bg-white text-[var(--deep)]' : 'text-white/75')}>{b === 'monthly' ? tx('Monthly', 'شهري') : tx(`Yearly −${yearlySaving()}%`, `سنوي −${yearlySaving()}%`)}</button>)}
            </div>
            <div className="mt-6 flex items-baseline justify-between border-t border-white/15 pt-4"><span className="text-white/70">{tx('Total today', 'الإجمالي اليوم')}</span><span className="figure text-[2rem]">{tx(`AED ${price(d.billing)}`, `${price(d.billing)} درهم`)}</span></div>
            <p className="mt-1 text-end text-xs text-white/60">{d.billing === 'monthly' ? tx('then every month', 'ثم كل شهر') : tx('then every year', 'ثم كل سنة')}</p>
            <ul className="mt-6 space-y-2 text-sm text-white/85">
              {[tx('Weekly planning and Ask Murshid', 'التخطيط الأسبوعي و«اسأل مرشد»'), tx('Flashcards, notes, focus timer, quizzes', 'بطاقات وملاحظات ومؤقت واختبارات'), tx('Opportunities, applications and CV', 'الفرص والطلبات والسيرة'), tx('Cancel any time in Settings', 'ألغِ في أي وقت من الإعدادات')].map((x) => <li key={x} className="flex gap-2"><Check className="mt-0.5 size-4 shrink-0 text-[var(--spark)]" />{x}</li>)}
            </ul>
            <p className="mt-6 flex items-center gap-2 text-xs text-white/60"><ShieldCheck className="size-4" />{tx('No ads. Your data plans your week, and nothing else.', 'لا إعلانات. بياناتك تخطط أسبوعك فقط.')}</p>
          </div>
        </aside>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  const { tx } = useApp();
  return (
    <div className="min-h-dvh bg-[var(--bg)]">
      <header className="mx-auto flex max-w-[72rem] items-center justify-between px-5 py-5">
        <Link href="/" aria-label={tx('Murshid home', 'مرشد الرئيسية')} className="text-[var(--text)]"><Brand /></Link>
        <Link href="/pricing" className="text-sm text-[var(--text-muted)] hover:text-[var(--text)]">{tx('Back to pricing', 'العودة إلى الأسعار')}</Link>
      </header>
      <main id="main" className="mx-auto max-w-[72rem] px-5 pb-16">{children}</main>
    </div>
  );
}

export function CheckoutSuccess() {
  const { tx, locale } = useApp();
  const params = useSearchParams();
  const { sub } = useBilling();
  const order = params.get('order') ?? sub?.orderId;
  return (
    <Shell>
      <div className="mx-auto max-w-lg py-14 text-center" role="status">
        <span className="text-[var(--deep)]"><MyMascot size={120} mood="happy" /></span>
        <h1 className="mk-h2 mt-6 text-[2.75rem]">{tx('Welcome to Murshid', 'مرحباً بك في مرشد')}</h1>
        <p className="mt-4 text-[1rem] leading-relaxed text-[var(--text-muted)]">{tx('Your Single plan is active. We sent a receipt to your email (in the demo, nothing is sent).', 'خطتك الفردية نشطة. أرسلنا إيصالاً إلى بريدك (في العرض التجريبي لا يُرسل شيء).')}</p>
        {sub && (
          <dl className="mx-auto mt-8 grid max-w-sm grid-cols-2 gap-3 rounded-[20px] bg-[var(--surface)] p-5 text-start text-sm">
            <dt className="text-[var(--text-muted)]">{tx('Order', 'الطلب')}</dt><dd className="text-end tabular">{order}</dd>
            <dt className="text-[var(--text-muted)]">{tx('Plan', 'الخطة')}</dt><dd className="text-end">{tx('Single', 'الفردية')} · {sub.billing === 'monthly' ? tx('monthly', 'شهري') : tx('yearly', 'سنوي')}</dd>
            <dt className="text-[var(--text-muted)]">{tx('Renews', 'يتجدد')}</dt><dd className="text-end">{new Date(sub.renewsAt).toLocaleDateString(locale === 'ar' ? 'ar-AE' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</dd>
          </dl>
        )}
        <div className="mt-8 flex justify-center gap-2"><Button size="lg" asChild><Link href="/app/study">{tx('Open Murshid', 'افتح مرشد')}</Link></Button><Button size="lg" variant="secondary" asChild><Link href="/app/settings#plan">{tx('Manage plan', 'إدارة الخطة')}</Link></Button></div>
      </div>
    </Shell>
  );
}
