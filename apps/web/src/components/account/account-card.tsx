'use client';

import { DropdownMenu } from 'radix-ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ChevronDown, Copy, Download, KeyRound, Link2, LogOut, Settings, Trash2, Users } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { Button } from '@/components/ui/button';
import { Input, Label } from '@/components/ui/input';
import { deleteMyAccount, exportMyData, joinClass, linkChild, makeParentCode } from '@/lib/account-api';
import { signOut } from '@/lib/auth';

const ROLE: Record<string, [string, string]> = {
  student: ['Student', 'طالب'], parent: ['Parent', 'وليّ أمر'], teacher: ['Teacher', 'معلم'], school_admin: ['School admin', 'مسؤول المدرسة'], platform_admin: ['Murshid admin', 'مسؤول مرشد'],
};

/** Settings → Account (live product): who is signed in, codes that link people, and my data. */
export function AccountCard() {
  const { tx, account, setAccount, toast } = useApp();
  const router = useRouter();
  const [code, setCode] = useState<string | null>(null);
  const [child, setChild] = useState('');
  const [cls, setCls] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  if (!account) return null;
  const { me } = account;
  const run = async (key: string, fn: () => Promise<void>) => {
    setBusy(key);
    try { await fn(); } catch (e) { toast({ title: (e as Error).message, tone: 'danger' }); } finally { setBusy(null); }
  };
  const download = () => run('export', async () => {
    const data = await exportMyData();
    const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = 'murshid-my-data.json'; a.click(); URL.revokeObjectURL(url);
  });
  const remove = () => run('delete', async () => {
    await deleteMyAccount(); await signOut();
    try { for (const k of Object.keys(localStorage)) if (k.startsWith('murshid:')) localStorage.removeItem(k); } catch { /* storage blocked */ }
    setAccount(null); router.replace('/');
  });
  return (
    <section id="account" className="card col-span-12 scroll-mt-24 p-5 lg:col-span-6">
      <h2 className="card-title mb-1">{tx('Account', 'الحساب')}</h2>
      <p className="mb-4 text-sm text-muted-foreground"><bdi>{me.email}</bdi> · {tx(...(ROLE[me.role ?? ''] ?? ['', '']))}{account.licence ? ` · ${account.licence.orgName}` : ''}</p>
      {account.needsParent && <p className="mb-4 rounded-[14px] bg-[color-mix(in_oklab,var(--warning)_14%,transparent)] px-3 py-2 text-sm">{tx('You are under 13, so a parent needs to link to your account: give them your parent code below.', 'عمرك أقل من 13 عاماً، لذا يحتاج وليّ أمرك إلى الارتباط بحسابك: أعطه رمز وليّ الأمر أدناه.')}</p>}
      <div className="flex flex-col gap-4">
        {me.role === 'student' && (
          <div>
            <p className="text-sm font-medium">{tx('Link a parent', 'اربط وليّ أمر')}</p>
            <p className="mb-2 text-xs text-muted-foreground">{tx('A one-use code your parent types when they set up their account.', 'رمز لمرة واحدة يكتبه وليّ أمرك عند إعداد حسابه.')}</p>
            {code ? (
              <div className="flex items-center gap-2"><span dir="ltr" className="rounded-[12px] bg-surface px-3 py-2 font-mono text-lg tracking-[0.2em]">{code}</span>
                <Button size="sm" variant="secondary" onClick={() => { void navigator.clipboard?.writeText(code); toast({ title: tx('Code copied', 'نُسخ الرمز') }); }}><Copy />{tx('Copy', 'نسخ')}</Button></div>
            ) : <Button size="sm" variant="secondary" disabled={busy === 'code'} onClick={() => void run('code', async () => setCode((await makeParentCode()).code))}><KeyRound />{tx('Show my parent code', 'اعرض رمز وليّ الأمر')}</Button>}
          </div>
        )}
        {me.role === 'student' && (
          <form onSubmit={(e) => { e.preventDefault(); void run('class', async () => { const r = await joinClass(cls.trim()); setCls(''); toast({ title: tx(`Joined ${r.name}`, `انضممت إلى ${r.name}`) }); }); }} className="flex items-end gap-2">
            <div className="flex-1"><Label htmlFor="acc-class">{tx('Join a class with its code', 'انضم إلى صف برمزه')}</Label><Input id="acc-class" value={cls} onChange={(e) => setCls(e.target.value)} placeholder="ABC123" maxLength={12} autoCapitalize="characters" dir="ltr" /></div>
            <Button type="submit" variant="secondary" disabled={!cls.trim() || busy === 'class'}><Users />{tx('Join', 'انضم')}</Button>
          </form>
        )}
        {me.role === 'parent' && (
          <div>
            <p className="text-sm font-medium">{tx('Your children', 'أبناؤك')}</p>
            <p className="mb-2 text-xs text-muted-foreground">{me.children.length ? me.children.map((c) => c.name).join(', ') : tx('None linked yet.', 'لم يُربط أحد بعد.')}</p>
            <form onSubmit={(e) => { e.preventDefault(); void run('link', async () => { setAccount(await linkChild(child.trim())); setChild(''); toast({ title: tx('Linked', 'تم الربط') }); }); }} className="flex items-end gap-2">
              <div className="flex-1"><Label htmlFor="acc-child">{tx('Child’s code', 'رمز الطفل')}</Label><Input id="acc-child" value={child} onChange={(e) => setChild(e.target.value)} placeholder="ABC123" maxLength={12} autoCapitalize="characters" dir="ltr" /></div>
              <Button type="submit" variant="secondary" disabled={!child.trim() || busy === 'link'}><Link2 />{tx('Link', 'اربط')}</Button>
            </form>
          </div>
        )}
        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" variant="secondary" onClick={download} disabled={busy === 'export'}><Download />{tx('Download my data', 'نزّل بياناتي')}</Button>
          <Button size="sm" variant="secondary" onClick={() => void signOut().then(() => router.replace('/sign-in'))}><LogOut />{tx('Sign out', 'تسجيل الخروج')}</Button>
        </div>
        <details className="rounded-[16px] border border-border p-3">
          <summary className="cursor-pointer text-sm font-medium text-[var(--danger)]">{tx('Delete my account', 'احذف حسابي')}</summary>
          <p className="mt-2 text-xs text-muted-foreground">{tx('This removes your account and what is in it. It cannot be undone. Type DELETE to confirm.', 'يحذف هذا حسابك وما فيه ولا يمكن التراجع. اكتب DELETE للتأكيد.')}</p>
          <div className="mt-2 flex gap-2"><Input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label={tx('Type DELETE', 'اكتب DELETE')} dir="ltr" className="h-9" />
            <Button size="sm" variant="danger" disabled={confirm !== 'DELETE' || busy === 'delete'} onClick={remove}><Trash2 />{tx('Delete', 'حذف')}</Button></div>
        </details>
      </div>
    </section>
  );
}

/** Top bar (live product): the signed-in person, instead of the demo-student switcher. */
export function AccountMenu() {
  const { tx, account } = useApp();
  const router = useRouter();
  const name = account?.me.name ?? account?.me.email ?? '';
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="inline-flex h-10 items-center gap-2.5 rounded-full bg-surface ps-1 pe-3 text-sm transition-colors hover:bg-[color-mix(in_oklab,var(--surface)_80%,var(--text)_6%)]" aria-label={tx('Account', 'الحساب')}>
          <span className="inline-flex size-8 items-center justify-center rounded-full bg-[var(--deep)] text-[0.75rem] font-medium text-white">{(name[0] ?? '?').toUpperCase()}</span>
          <span className="hidden max-w-[10rem] truncate text-start text-[0.8125rem] font-medium md:block" dir="auto">{name.split(' ')[0]}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="end" sideOffset={8} className="z-50 w-64 rounded-[24px] bg-popover p-2 shadow-lift">
          <div className="px-3 py-2"><p className="truncate text-sm font-medium" dir="auto">{name}</p><p className="truncate text-xs text-muted-foreground" dir="ltr">{account?.me.email}</p></div>
          {account?.me.role === 'parent' && account.me.children.length > 0 && <p className="px-3 pb-2 text-xs text-muted-foreground">{tx(`Viewing ${account.me.children[0]!.name} (read only)`, `تعرض حساب ${account.me.children[0]!.name} (للاطلاع فقط)`)}</p>}
          <DropdownMenu.Item asChild><Link href="/app/settings#account" className="flex items-center gap-2.5 rounded-[14px] px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface"><Settings className="size-4" />{tx('Account settings', 'إعدادات الحساب')}</Link></DropdownMenu.Item>
          <DropdownMenu.Item onSelect={() => void signOut().then(() => router.replace('/sign-in'))} className="flex cursor-pointer items-center gap-2.5 rounded-[14px] px-3 py-2 text-sm outline-none data-[highlighted]:bg-surface"><LogOut className="size-4" />{tx('Sign out', 'تسجيل الخروج')}</DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
