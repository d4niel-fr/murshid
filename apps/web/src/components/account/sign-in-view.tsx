'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Loader2, Mail } from 'lucide-react';
import { useEffect, useState } from 'react';
import { MyMascot } from '@/components/mascot/my-mascot';
import { useApp } from '@/components/providers/app-provider';
import { MicrosoftMark, MurshidMark } from '@/components/shell/icons';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { authEnabled, emailLink, getSession, resetPassword, safeNext, setNewPassword, signInWithPassword, signUp, supabase, withProvider } from '@/lib/auth';
import { cn } from '@/lib/utils';

type Mode = 'signin' | 'signup' | 'link' | 'forgot' | 'reset';

function GoogleMark({ className = 'size-4' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.5-5.2 3.5-8.8Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1.1.7-2.4 1.2-4 1.2-3.1 0-5.7-2.1-6.6-4.9H1.4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.4 14.4a7.2 7.2 0 0 1 0-4.7V6.6h-4a12 12 0 0 0 0 10.8l4-3Z" />
      <path fill="#EA4335" d="M12 4.8c1.7 0 3.3.6 4.5 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  );
}

/** Plain-language messages for what Supabase sends back. */
function friendly(message: string, tx: (en: string, ar: string) => string): string {
  if (/invalid login credentials/i.test(message)) return tx('That email and password don’t match. Try again, or get a sign-in link by email.', 'البريد وكلمة المرور غير متطابقين. حاول مرة أخرى أو اطلب رابط دخول بالبريد.');
  if (/email not confirmed/i.test(message)) return tx('Confirm your email first: open the link we sent you.', 'أكّد بريدك أولاً: افتح الرابط الذي أرسلناه إليك.');
  if (/already registered|already been registered/i.test(message)) return tx('This email already has an account. Sign in instead.', 'لهذا البريد حساب بالفعل. سجّل الدخول بدلاً من ذلك.');
  if (/password should be at least|weak password/i.test(message)) return tx('Use a longer password: at least 8 characters, with a number.', 'استخدم كلمة مرور أطول: 8 أحرف على الأقل مع رقم.');
  if (/rate limit|too many/i.test(message)) return tx('Too many tries. Wait a minute, then try again.', 'محاولات كثيرة. انتظر دقيقة ثم حاول مرة أخرى.');
  if (/fetch|network/i.test(message)) return tx('Could not reach the sign-in service. Check your connection.', 'تعذّر الوصول إلى خدمة الدخول. تحقق من اتصالك.');
  return message;
}

export function SignInView() {
  const { tx } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get('next'));
  const [mode, setMode] = useState<Mode>(params.get('reset') ? 'reset' : params.get('mode') === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(params.get('error'));
  const [sent, setSent] = useState<string | null>(null);

  // already signed in: straight to the app
  useEffect(() => { if (authEnabled && mode !== 'reset') void getSession().then((s) => { if (s) router.replace(next); }); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<{ error: { message: string } | null } | void>) => {
    setBusy(key); setError(null); setSent(null);
    try { const r = await fn(); if (r && r.error) setError(friendly(r.error.message, tx)); }
    catch (e) { setError(friendly((e as Error).message, tx)); }
    finally { setBusy(null); }
  };
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'signin') void run('form', async () => { const r = await signInWithPassword(email.trim(), password); if (!r.error) router.replace(next); return r; });
    if (mode === 'signup') void run('form', async () => {
      if (password.length < 8 || !/\d/.test(password)) return { error: { message: 'weak password' } };
      const r = await signUp(email.trim(), password, name.trim(), next);
      if (!r.error) { if (r.data.session) router.replace(next); else setSent(tx('Check your email: open the link to confirm your account.', 'تحقق من بريدك: افتح الرابط لتأكيد حسابك.')); }
      return r;
    });
    if (mode === 'link') void run('form', async () => { const r = await emailLink(email.trim(), next); if (!r.error) setSent(tx(`We sent a sign-in link to ${email.trim()}. It works once and expires in an hour.`, `أرسلنا رابط دخول إلى ${email.trim()}. يعمل مرة واحدة وينتهي خلال ساعة.`)); return r; });
    if (mode === 'forgot') void run('form', async () => { const r = await resetPassword(email.trim()); if (!r.error) setSent(tx('If that email has an account, a link to set a new password is on its way.', 'إذا كان لهذا البريد حساب، فرابط تعيين كلمة مرور جديدة في الطريق.')); return r; });
    if (mode === 'reset') void run('form', async () => {
      if (password.length < 8 || !/\d/.test(password)) return { error: { message: 'weak password' } };
      const r = await setNewPassword(password); if (!r.error) router.replace('/app'); return r;
    });
  };

  const title = { signin: tx('Sign in to Murshid', 'تسجيل الدخول إلى مرشد'), signup: tx('Create your account', 'أنشئ حسابك'), link: tx('Get a sign-in link', 'احصل على رابط دخول'), forgot: tx('Forgot your password?', 'نسيت كلمة المرور؟'), reset: tx('Set a new password', 'عيّن كلمة مرور جديدة') }[mode];

  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4 py-10">
      <div className="w-full max-w-[26rem]">
        <Link href="/" className="mb-8 flex items-center justify-center" aria-label={tx('Murshid home', 'الصفحة الرئيسية لمرشد')}><MurshidMark className="h-8" /></Link>
        <div className="card p-6 sm:p-8">
          <div className="mb-5 flex items-center gap-3"><span className="text-[var(--deep)]"><MyMascot size={44} mood={error ? 'thinking' : 'happy'} /></span><h1 className="text-[1.5rem] font-medium leading-tight">{title}</h1></div>
          {!authEnabled ? (
            <div className="flex flex-col gap-4 text-sm">
              <p className="text-muted-foreground">{tx('This is the Murshid demo: it runs on made-up students, so there is no account to sign in to.', 'هذا عرض مرشد التجريبي: يعمل على طلاب افتراضيين، فلا يوجد حساب لتسجيل الدخول إليه.')}</p>
              <Button asChild size="lg"><Link href="/app">{tx('Open the demo', 'افتح العرض التجريبي')}</Link></Button>
              <Button asChild variant="secondary"><Link href="/welcome">{tx('How to get Murshid', 'كيف تحصل على مرشد')}</Link></Button>
            </div>
          ) : sent ? (
            <div className="flex flex-col items-start gap-3">
              <CheckCircle2 className="size-8 text-success" />
              <p className="text-[0.9375rem]">{sent}</p>
              <button type="button" onClick={() => { setSent(null); setMode('signin'); }} className="text-sm font-medium text-[var(--brand)]">{tx('Back to sign in', 'العودة لتسجيل الدخول')}</button>
            </div>
          ) : (
            <>
              {(mode === 'signin' || mode === 'signup') && (
                <div className="mb-5 flex flex-col gap-2.5">
                  <button type="button" disabled={Boolean(busy)} onClick={() => void run('google', () => withProvider('google', next))} className="flex h-12 items-center justify-center gap-3 rounded-full border border-border bg-[var(--popover)] text-[0.9375rem] font-medium transition-colors hover:border-foreground/40 disabled:opacity-60">
                    {busy === 'google' ? <Loader2 className="size-4 animate-spin" /> : <GoogleMark className="size-5" />}{tx('Continue with Google', 'المتابعة باستخدام Google')}
                  </button>
                  <button type="button" disabled={Boolean(busy)} onClick={() => void run('ms', () => withProvider('azure', next))} className="flex h-12 items-center justify-center gap-3 rounded-full border border-border bg-[var(--popover)] text-[0.9375rem] font-medium transition-colors hover:border-foreground/40 disabled:opacity-60">
                    {busy === 'ms' ? <Loader2 className="size-4 animate-spin" /> : <MicrosoftMark className="size-5" />}{tx('Continue with Microsoft (school)', 'المتابعة باستخدام Microsoft (المدرسة)')}
                  </button>
                  <div className="my-2 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />{tx('or with email', 'أو بالبريد')}<span className="h-px flex-1 bg-border" /></div>
                </div>
              )}
              {mode !== 'signin' && mode !== 'signup' && mode !== 'reset' && <button type="button" onClick={() => setMode('signin')} className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4 rtl:rotate-180" />{tx('Back', 'رجوع')}</button>}
              <form onSubmit={submit} className="flex flex-col gap-3.5" noValidate={false}>
                {mode === 'signup' && <div><Label htmlFor="si-name">{tx('Your name', 'اسمك')}</Label><Input id="si-name" dir="auto" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required maxLength={80} /></div>}
                {mode !== 'reset' && <div><Label htmlFor="si-email">{tx('Email', 'البريد الإلكتروني')}</Label><Input id="si-email" type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" inputMode="email" required maxLength={160} /></div>}
                {(mode === 'signin' || mode === 'signup' || mode === 'reset') && (
                  <div>
                    <div className="flex items-baseline justify-between"><Label htmlFor="si-pass">{mode === 'reset' ? tx('New password', 'كلمة المرور الجديدة') : tx('Password', 'كلمة المرور')}</Label>
                      {mode === 'signin' && <button type="button" onClick={() => setMode('forgot')} className="text-xs text-muted-foreground hover:text-foreground">{tx('Forgot?', 'نسيتها؟')}</button>}</div>
                    <div className="relative">
                      <Input id="si-pass" type={show ? 'text' : 'password'} dir="ltr" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signin' ? 1 : 8} maxLength={128} className="pe-11" />
                      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? tx('Hide password', 'إخفاء كلمة المرور') : tx('Show password', 'إظهار كلمة المرور')} className="absolute end-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-full text-muted-foreground hover:text-foreground">{show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}</button>
                    </div>
                    {mode !== 'signin' && <p className="mt-1.5 text-xs text-muted-foreground">{tx('At least 8 characters, with a number.', '8 أحرف على الأقل، مع رقم.')}</p>}
                  </div>
                )}
                {error && <p role="alert" className="rounded-[14px] bg-[color-mix(in_oklab,var(--danger)_10%,transparent)] px-3 py-2 text-sm text-danger">{error}</p>}
                <Button type="submit" size="lg" disabled={Boolean(busy)}>{busy === 'form' && <Loader2 className="animate-spin" />}
                  {{ signin: tx('Sign in', 'تسجيل الدخول'), signup: tx('Create account', 'إنشاء الحساب'), link: tx('Email me a link', 'أرسل لي رابطاً'), forgot: tx('Send the reset link', 'أرسل رابط إعادة التعيين'), reset: tx('Save password', 'حفظ كلمة المرور') }[mode]}
                </Button>
              </form>
              {mode === 'signin' && <button type="button" onClick={() => setMode('link')} className="mt-3 flex w-full items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground"><Mail className="size-4" />{tx('Email me a sign-in link instead', 'أرسل لي رابط دخول بدلاً من ذلك')}</button>}
              <p className="mt-6 text-center text-sm text-muted-foreground">
                {mode === 'signup' ? <>{tx('Already have an account?', 'لديك حساب بالفعل؟')} <button type="button" onClick={() => setMode('signin')} className="font-medium text-foreground underline-offset-4 hover:underline">{tx('Sign in', 'سجّل الدخول')}</button></>
                  : mode === 'signin' ? <>{tx('New to Murshid?', 'جديد على مرشد؟')} <button type="button" onClick={() => setMode('signup')} className="font-medium text-foreground underline-offset-4 hover:underline">{tx('Create an account', 'أنشئ حساباً')}</button></> : null}
              </p>
            </>
          )}
        </div>
        <p className={cn('mt-6 text-center text-xs leading-relaxed text-muted-foreground')}>
          {tx('By continuing you agree to how Murshid uses data, explained in plain words in our ', 'بالمتابعة توافق على طريقة استخدام مرشد للبيانات، الموضّحة بكلمات بسيطة في ')}<Link href="/privacy" className="underline underline-offset-2">{tx('privacy page', 'صفحة الخصوصية')}</Link>.
        </p>
      </div>
    </main>
  );
}

/** Where Google, Microsoft and emailed links come back to: finishes the sign-in, then opens the app. */
export function AuthCallback() {
  const { tx } = useApp();
  const router = useRouter();
  const params = useSearchParams();
  const [error, setError] = useState<string | null>(params.get('error_description'));
  useEffect(() => {
    if (error || !authEnabled) return;
    let done = false;
    void (async () => {
      const client = await supabase();
      const code = params.get('code');
      if (client && code) {
        const r = await client.auth.exchangeCodeForSession(code).catch((e: Error) => ({ error: e }));
        if ('error' in r && r.error && !(await getSession())) { setError(r.error.message); return; }
      }
      const s = await getSession();
      if (!done) { if (s) router.replace(safeNext(params.get('next'))); else setError(tx('That link has expired or was already used. Sign in again.', 'انتهت صلاحية الرابط أو استُخدم من قبل. سجّل الدخول مرة أخرى.')); }
    })();
    return () => { done = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main className="grid min-h-dvh place-items-center bg-[var(--bg)] px-4">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-[var(--deep)]"><MyMascot size={88} mood={error ? 'thinking' : 'happy'} /></span>
        <h1 className="text-xl font-medium">{error ? tx('Sign-in didn’t finish', 'لم يكتمل تسجيل الدخول') : tx('Signing you in…', 'جارٍ تسجيل دخولك…')}</h1>
        {error ? <><p className="max-w-sm text-sm text-muted-foreground">{error}</p><Button asChild><Link href="/sign-in">{tx('Back to sign in', 'العودة لتسجيل الدخول')}</Link></Button></> : <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      </div>
    </main>
  );
}
