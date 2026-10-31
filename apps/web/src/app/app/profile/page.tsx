'use client';

import { Dialog as D } from 'radix-ui';
import { AnimatePresence, motion } from 'motion/react';
import { ExternalLink, FileText, Globe, Loader2, Lock, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { useApp, useEndpoint } from '@/components/providers/app-provider';
import { GitHubIcon, InstagramIcon, LinkedInIcon } from '@/components/shell/icons';
import { Bento, Page, PageHeader } from '@/components/shared/page';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { DialogContent } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/input';
import { ProgressBar } from '@/components/ui/progress-bar';
import { formatDate } from '@/lib/dates';
import type { FeatureId } from '@/lib/bands';
import type { LinkKey, ProfileLinks } from '@/lib/types';
import { cn } from '@/lib/utils';

const PROVIDERS: { key: LinkKey; name: string; Icon: ComponentType<{ className?: string }>; prefix: string; placeholder: string; requires: FeatureId; blurb: [string, string] }[] = [
  { key: 'linkedin', name: 'LinkedIn', Icon: LinkedInIcon, prefix: 'https://www.linkedin.com/in/', placeholder: 'your-name', requires: 'linkedin', blurb: ['Show your experience to programmes and universities.', 'اعرض خبراتك للبرامج والجامعات.'] },
  { key: 'github', name: 'GitHub', Icon: GitHubIcon, prefix: 'https://github.com/', placeholder: 'username', requires: 'portfolio', blurb: ['Pull in hackathon and coding projects.', 'اجلب مشاريع الهاكاثون والبرمجة.'] },
  { key: 'instagram', name: 'Instagram', Icon: InstagramIcon, prefix: 'https://instagram.com/', placeholder: 'handle', requires: 'socialLinks', blurb: ['For art, music or sports portfolios only.', 'لملفات الفن أو الموسيقى أو الرياضة فقط.'] },
  { key: 'portfolio', name: 'Portfolio', Icon: Globe, prefix: 'https://', placeholder: 'your-site.com', requires: 'portfolio', blurb: ['Your own website or project page.', 'موقعك الخاص أو صفحة مشاريعك.'] },
];

function ConnectDialog({ p, open, setOpen, onConnect }: { p: (typeof PROVIDERS)[number]; open: boolean; setOpen: (v: boolean) => void; onConnect: (url: string) => void }) {
  const { tx } = useApp();
  const [handle, setHandle] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setHandle(''); setBusy(false); } }, [open]);
  const submit = () => {
    const h = handle.trim().replace(/^@/, '');
    if (!h) return;
    setBusy(true);
    // Mock OAuth/verification round-trip.
    setTimeout(() => { onConnect(/^https?:\/\//.test(h) ? h : p.prefix + h); setOpen(false); }, 900);
  };
  return (
    <D.Root open={open} onOpenChange={setOpen}>
      <DialogContent title={tx(`Connect ${p.name}`, `ربط ${p.name}`)} description={tx('Demo connection: nothing leaves this device. Only the public profile link is stored.', 'ربط تجريبي: لا يغادر شيء جهازك. يُحفظ رابط الملف العام فقط.')}>
        <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="grid gap-4">
          <div>
            <Label htmlFor="h">{tx('Profile', 'الملف')}</Label>
            <div className="flex items-center overflow-hidden rounded-[var(--radius-sm)] border border-border bg-field focus-within:border-[var(--brand-light)]" dir="ltr">
              <span className="whitespace-nowrap bg-surface-2 px-3 py-2.5 text-sm text-muted-foreground">{p.prefix}</span>
              <input id="h" autoFocus value={handle} onChange={(e) => setHandle(e.target.value)} placeholder={p.placeholder} className="h-10 min-w-0 flex-1 bg-transparent px-2 text-sm outline-none" />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <D.Close asChild><Button variant="ghost">{tx('Cancel', 'إلغاء')}</Button></D.Close>
            <Button type="submit" disabled={!handle.trim() || busy}>{busy ? <><Loader2 className="animate-spin" />{tx('Connecting…', 'جارٍ الربط…')}</> : tx('Connect', 'ربط')}</Button>
          </div>
        </form>
      </DialogContent>
    </D.Root>
  );
}

export default function ProfilePage() {
  const { world, tx, locale, update, toast, bandConfig, client, band } = useApp();
  const { data: apiLinks, source } = useEndpoint<ProfileLinks>(`links:${band}`, (c) => c.getProfileLinks(), world.links);
  const links = source === 'api' ? apiLinks : world.links;
  const [connecting, setConnecting] = useState<LinkKey | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<{ url: string; name: string; type: string } | null>(null);
  const guardianManaged = !bandConfig.features.socialLinks;

  const save = (next: ProfileLinks) => {
    update((u) => ({ ...u, links: next }));
    void client.putProfileLinks(next); // PUT /profile/links (falls back to local when API is down)
  };
  const connect = (key: LinkKey, url: string) => {
    save({ ...links, [key]: url, connectedAt: { ...links.connectedAt, [key]: world.today } });
    toast({ title: tx(`${PROVIDERS.find((p) => p.key === key)!.name} connected`, `تم ربط ${PROVIDERS.find((p) => p.key === key)!.name}`) });
  };
  const disconnect = (key: LinkKey) => {
    save({ ...links, [key]: null, connectedAt: { ...links.connectedAt, [key]: null } });
    toast({ title: tx('Disconnected', 'تم الفصل'), tone: 'info' });
  };
  const onFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { toast({ title: tx('File is larger than 5 MB', 'الملف أكبر من ٥ ميغابايت'), tone: 'danger' }); return; }
    const url = URL.createObjectURL(f);
    setPreview({ url, name: f.name, type: f.type });
    save({ ...links, resumeUrl: `local:${f.name}`, resumeName: f.name, connectedAt: { ...links.connectedAt, resume: world.today } });
    toast({ title: tx('Resume uploaded', 'تم رفع السيرة'), description: f.name });
  };
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview.url); }, [preview]);

  const total = 5;
  const n = [links.resumeUrl, links.linkedin, links.github, links.instagram, links.portfolio].filter(Boolean).length;

  return (
    <Page wide>
      <PageHeader
        eyebrow={tx(`${n} of ${total} connected`, `${n} من ${total} مرتبطة`)}
        title={tx('Profile & links', 'الملف والروابط')}
        subtitle={tx('Your resume and the profiles you choose to share with programmes, counsellors and universities.', 'سيرتك والحسابات التي تختار مشاركتها مع البرامج والمرشدين والجامعات.')}
      />
      {guardianManaged && (
        <div className="mb-4 flex items-start gap-3 rounded-[var(--radius)] border border-border bg-surface-2 p-4 text-sm">
          <ShieldCheck className="mt-0.5 size-4 shrink-0 text-primary" />
          <p>{tx('In your grade band some social profiles are switched off, and your guardian can see what you share. You can still keep a resume and project links.', 'في مرحلتك بعض الحسابات الاجتماعية مغلقة، ويمكن لولي أمرك رؤية ما تشاركه. يمكنك الاحتفاظ بسيرة وروابط مشاريع.')}</p>
        </div>
      )}
      <Bento>
        <Card id="resume" className="col-span-12 xl:col-span-7">
          <CardHeader title={tx('Resume', 'السيرة الذاتية')} icon={<FileText />} action={links.connectedAt.resume ? <Badge tone="success">{tx('Updated', 'محدّثة')} {formatDate(links.connectedAt.resume, locale)}</Badge> : undefined} />
          <input ref={fileRef} type="file" accept=".pdf,.doc,.docx,application/pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          {links.resumeUrl ? (
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-3 rounded-[var(--radius)] bg-surface-2 p-3">
                <span className="inline-flex size-10 items-center justify-center rounded-full bg-[var(--deep)]"><FileText className="size-5 text-white" /></span>
                <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{links.resumeName ?? 'resume.pdf'}</p><p className="text-xs text-muted-foreground">{preview ? tx('Preview below', 'المعاينة أدناه') : tx('Stored for your applications', 'محفوظة لطلباتك')}</p></div>
                <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}><Upload />{tx('Replace', 'استبدال')}</Button>
                <Button size="icon-sm" variant="ghost" aria-label={tx('Remove resume', 'حذف السيرة')} onClick={() => { setPreview(null); save({ ...links, resumeUrl: null, resumeName: null, connectedAt: { ...links.connectedAt, resume: null } }); toast({ title: tx('Resume removed', 'تم حذف السيرة'), tone: 'info' }); }}><Trash2 /></Button>
              </div>
              {preview && preview.type === 'application/pdf' ? (
                <iframe title="Resume preview" src={preview.url} className="h-[420px] w-full rounded-[var(--radius)] border border-border bg-surface" />
              ) : (
                <div className="rounded-[var(--radius)] bg-surface-2 p-5">
                  <p className="text-lg font-semibold">{world.dashboard.student.firstName} {world.dashboard.student.lastName}</p>
                  <p className="text-sm text-muted-foreground">{world.dashboard.student.classLabel} · {world.dashboard.student.school}</p>
                  <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div><p className="eyebrow mb-1">{tx('Academics', 'الدراسة')}</p>{world.academics.subjects.slice(0, 4).map((s) => <p key={s.id} className="truncate">{s.name}</p>)}</div>
                    <div><p className="eyebrow mb-1">{tx('Activities', 'الأنشطة')}</p>{world.extracurriculars.activities.map((a) => <p key={a.id} className="truncate">{a.name} · {a.totalHours}h</p>)}</div>
                  </div>
                  <p className="mt-4 text-2xs text-muted-foreground">{tx('Generated preview from your Murshid data. Upload a PDF to preview your own file.', 'معاينة من بيانات مرشد. ارفع ملف PDF لمعاينة ملفك.')}</p>
                </div>
              )}
            </div>
          ) : (
            <button onClick={() => fileRef.current?.click()} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
              className="flex flex-col items-center gap-2 rounded-[var(--radius)] border-[1.5px] border-dashed border-[color-mix(in_oklab,var(--text-muted)_45%,transparent)] bg-surface-2 px-6 py-10 text-center transition-colors hover:border-[var(--accent)] hover:bg-surface-2">
              <Upload className="size-6 text-muted-foreground" />
              <span className="text-sm font-medium">{tx('Upload your resume', 'ارفع سيرتك الذاتية')}</span>
              <span className="text-xs text-muted-foreground">{tx('PDF or Word, up to 5 MB. Drag and drop works too.', 'PDF أو Word حتى ٥ ميغابايت. يمكنك السحب والإفلات.')}</span>
            </button>
          )}
        </Card>

        <LinkedInCard />

        <Card className="col-span-12 xl:col-span-5">
          <CardHeader title={tx('Profile strength', 'قوة الملف')} />
          <p className="text-3xl font-semibold tabular">{Math.round((n / total) * 100)}%</p>
          <ProgressBar value={(n / total) * 100} className="mt-2" />
          <p className="mt-3 text-sm text-muted-foreground">{n < total ? tx('Add the missing links below. Programmes look for a resume plus at least one project link.', 'أضف الروابط الناقصة أدناه. تبحث البرامج عن سيرة ورابط مشروع واحد على الأقل.') : tx('Everything connected. Nice.', 'كل شيء مرتبط. رائع.')}</p>
        </Card>

        {PROVIDERS.map((p) => {
          const allowed = bandConfig.features[p.requires] || (p.key === 'portfolio');
          const url = links[p.key];
          return (
            <Card key={p.key} id={p.key} className="col-span-12 md:col-span-6 xl:col-span-3">
              <div className="mb-3 flex items-center gap-3">
                <span className={cn('inline-flex size-10 items-center justify-center rounded-full', url ? 'bg-foreground text-background' : 'bg-surface-2 text-muted-foreground')}><p.Icon className="size-5" /></span>
                <div className="min-w-0">
                  <p className="font-semibold">{p.name}</p>
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.p key={url ? 'on' : 'off'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} className={cn('text-xs', url ? 'text-[var(--success)]' : 'text-muted-foreground')}>
                      {url ? `${tx('Connected', 'مرتبط')}${links.connectedAt[p.key] ? ` · ${formatDate(links.connectedAt[p.key]!, locale)}` : ''}` : allowed ? tx('Not connected', 'غير مرتبط') : tx('Off for your grade band', 'غير متاح لمرحلتك')}
                    </motion.p>
                  </AnimatePresence>
                </div>
              </div>
              <p className="mb-4 text-sm text-muted-foreground">{tx(p.blurb[0], p.blurb[1])}</p>
              {url ? (
                <div className="mt-auto flex gap-2">
                  <Button size="sm" variant="outline" asChild><a href={url} target="_blank" rel="noreferrer"><ExternalLink className="rtl:-scale-x-100" />{tx('Open', 'فتح')}</a></Button>
                  <Button size="sm" variant="ghost" onClick={() => disconnect(p.key)}>{tx('Disconnect', 'فصل')}</Button>
                </div>
              ) : allowed ? (
                <Button size="sm" className="mt-auto self-start" onClick={() => setConnecting(p.key)}>{tx('Connect', 'ربط')}</Button>
              ) : (
                <span className="mt-auto inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="size-3.5" />{tx('Guardian-managed', 'بإدارة ولي الأمر')}</span>
              )}
            </Card>
          );
        })}
      </Bento>
      {PROVIDERS.map((p) => (
        <ConnectDialog key={p.key} p={p} open={connecting === p.key} setOpen={(v) => setConnecting(v ? p.key : null)} onConnect={(u) => connect(p.key, u)} />
      ))}
    </Page>
  );
}

/** LinkedIn-ready CV generated by Murshid from the student's real data (API only; hidden on the bundled mock). */
function LinkedInCard() {
  const { client, tx, apiStatus } = useApp();
  const [pack, setPack] = useState<Record<string, any> | null>(null);
  useEffect(() => { let on = true; void client.getLinkedIn().then((p) => { if (on) setPack(p); }); return () => { on = false; }; }, [client]);
  if (!pack || apiStatus === 'down') return null;
  const openPdf = async () => {
    const res = await fetch(client.cvPdfUrl(), { headers: { 'x-dev-user': client.devUser, 'x-dev-user-id': client.devUser } });
    window.open(URL.createObjectURL(await res.blob()), '_blank');
  };
  return (
    <Card id="linkedin-cv" className="col-span-12">
      <CardHeader title={tx('LinkedIn-ready CV', 'سيرة جاهزة لـ LinkedIn')} icon={<LinkedInIcon className="size-4" />} action={<Badge tone="neutral">{tx('synthetic demo', 'بيانات تجريبية')}</Badge>} />
      <div className="grid gap-6 md:grid-cols-[1.3fr_1fr]">
        <div>
          <p className="text-base font-semibold leading-snug">{pack.headline}</p>
          <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{pack.about}</p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => void openPdf()}><FileText />{tx('Open CV (PDF)', 'افتح السيرة (PDF)')}</Button>
            <Button size="sm" variant="outline" onClick={() => void navigator.clipboard?.writeText(`${pack.headline}\n\n${pack.about}`)}>{tx('Copy headline + About', 'نسخ العنوان والنبذة')}</Button>
          </div>
        </div>
        <div className="space-y-3 text-sm">
          <div><p className="eyebrow mb-1">{tx('Experience', 'الخبرات')}</p><ul className="space-y-1">{(pack.experience ?? []).map((e: any, i: number) => <li key={i}><span className="font-medium">{e.title}</span> · {e.organization}</li>)}</ul></div>
          <div><p className="eyebrow mb-1">{tx('Skills', 'المهارات')}</p><div className="flex flex-wrap gap-1.5">{(pack.skills ?? []).slice(0, 12).map((s2: string) => <span key={s2} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{s2}</span>)}</div></div>
          <div><p className="eyebrow mb-1">{tx('Featured', 'مميز')}</p><ul className="space-y-1">{(pack.featured ?? []).map((f: any, i: number) => <li key={i}>{f.title}</li>)}</ul></div>
        </div>
      </div>
    </Card>
  );
}
