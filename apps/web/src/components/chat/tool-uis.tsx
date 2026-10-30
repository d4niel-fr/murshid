'use client';

import { motion } from 'motion/react';
import { CalendarDays, Download, FileText, ListChecks, Sparkles } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useApp } from '@/components/providers/app-provider';
import { ChartCard } from '@/components/charts/chart-card';
import { OpportunityCard } from '@/components/shared/opportunity-card';
import { TaskList } from '@/components/shared/task-list';
import { messageIn } from '@/lib/motion';
import { buildChartSpec, type ProgressQuery } from '@/lib/progress';
import type { ChartRange, ChartSpec, Opportunity, Task } from '@/lib/types';

/* Props from assistant-ui's ToolCallMessagePartProps; typed loosely because args come from the wire. */
interface ToolProps { args: unknown; status?: { type: string } }

function ToolSkeleton({ label }: { label: string }) {
  return (
    <div className="card p-5">
      <p className="mb-3 animate-pulse text-sm text-muted-foreground">{label}</p>
      <div className="h-[200px] rounded-lg bg-surface-2" />
    </div>
  );
}

function isSpec(x: unknown): x is ChartSpec & { query?: Omit<ProgressQuery, 'locale'> } {
  const o = x as Record<string, unknown> | null;
  return !!o && Array.isArray(o.data) && Array.isArray(o.series) && typeof o.type === 'string';
}

export function RenderChartTool({ args, status }: ToolProps) {
  const { world, locale, tx, bandConfig } = useApp();
  const initial = isSpec(args) ? args : null;
  const [range, setRange] = useState<ChartRange | null>(null);
  const spec = useMemo(() => {
    if (!initial) return null;
    if (range && initial.query) return buildChartSpec(world, { ...initial.query, range, locale });
    return initial;
  }, [initial, range, world, locale]);
  if (!spec) return status?.type === 'running' ? <ToolSkeleton label={tx('Building your chart…', 'جارٍ إعداد الرسم…')} /> : null;
  const q = initial?.query;
  const href = q ? `/app/insights?area=${encodeURIComponent(q.compare?.length ? 'compare' : q.area)}&range=${range ?? q.range}${q.type ? `&type=${q.type}` : ''}${q.compare?.length ? `&compare=${q.compare.join(',')}` : ''}` : '/app/insights';
  return (
    <ChartCard
      inline
      spec={spec}
      height={220}
      range={q ? (range ?? q.range) : undefined}
      onRange={q ? setRange : undefined}
      allowedRanges={bandConfig.chartDefaults.allowedRanges}
      footerLink={{ href, label: tx('Open in Insights', 'افتح في الرؤى') }}
    />
  );
}

export function ShowTasksTool({ args }: ToolProps) {
  const { world, tx } = useApp();
  const a = args as { tasks?: Task[] } | null;
  // Render the live list so ticks here and on the dashboard stay in sync.
  const ids = new Set((a?.tasks ?? []).map((t) => t.id));
  const tasks = world.dashboard.today.filter((t) => ids.size === 0 || ids.has(t.id) || t.id.startsWith('u-'));
  return (
    <motion.div {...messageIn} className="card p-5">
      <p className="eyebrow mb-3 flex items-center gap-2"><ListChecks className="size-4" />{tx("Today's tasks", 'مهام اليوم')}</p>
      <TaskList tasks={tasks.length ? tasks : (a?.tasks ?? [])} allowAdd={false} />
    </motion.div>
  );
}

export function ShowOpportunitiesTool({ args }: ToolProps) {
  const { tx } = useApp();
  const list = ((args as { opportunities?: Opportunity[] } | null)?.opportunities ?? []).filter((o) => o && o.id);
  return (
    <motion.div {...messageIn} className="card p-5">
      <p className="eyebrow mb-3 flex items-center gap-2"><Sparkles className="size-4" />{tx('Opportunities for you', 'فرص مناسبة لك')}</p>
      <div className="no-scrollbar -mx-1 flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-1">
        {list.map((o) => (
          <div key={o.id} className="w-[260px] shrink-0 snap-start"><OpportunityCard o={o} /></div>
        ))}
      </div>
    </motion.div>
  );
}

/* ---------- orchestrator cards ---------- */

interface PlanDay { date: string; weekday: string; items: { time: string; title: string; minutes: number; new: boolean }[] }

/** build_week_plan result: the 7-day plan, new items highlighted. */
export function ShowPlanTool({ args }: ToolProps) {
  const { tx } = useApp();
  const a = (args ?? {}) as { days?: PlanDay[]; summary?: string; start?: string };
  const days = Array.isArray(a.days) ? a.days : [];
  if (!days.length) return null;
  return (
    <motion.div {...messageIn} className="card p-5">
      <p className="eyebrow mb-1 flex items-center gap-2"><CalendarDays className="size-4" />{tx('Your week plan (saved to Planner)', 'خطة أسبوعك (محفوظة في المخطط)')}</p>
      {a.summary && <p className="mb-3 text-sm text-muted-foreground">{a.summary}</p>}
      <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
        {days.map((d) => (
          <div key={d.date} className="rounded-lg border border-border p-3">
            <p className="mb-1.5 text-sm font-medium">{d.weekday} <span className="text-xs text-muted-foreground">{d.date}</span></p>
            <ul className="space-y-1 text-xs">
              {d.items.slice(0, 7).map((it, i) => (
                <li key={i} className={it.new ? 'font-medium text-foreground' : 'text-muted-foreground'}>
                  <span className="tabular-nums">{it.time}</span> · {it.title}{it.new && <span className="ms-1 rounded bg-brand-soft px-1 text-[0.625rem] text-brand">new</span>}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/** generate_linkedin_cv result: LinkedIn pack preview + PDF download. */
export function ShowCvTool({ args }: ToolProps) {
  const { tx, client } = useApp();
  const a = (args ?? {}) as { headline?: string; about?: string; skills?: string[]; experience?: { title: string; organization: string; bullets?: string[] }[]; featured?: { title: string }[] };
  const [copied, setCopied] = useState(false);
  const download = async () => {
    const res = await fetch(client.cvPdfUrl(), { headers: { 'x-dev-user': client.devUser, 'x-dev-user-id': client.devUser } });
    const url = URL.createObjectURL(await res.blob());
    window.open(url, '_blank');
  };
  return (
    <motion.div {...messageIn} className="card p-5">
      <p className="eyebrow mb-2 flex items-center gap-2"><FileText className="size-4" />{tx('LinkedIn profile pack', 'حزمة ملف LinkedIn')}</p>
      {a.headline && <p className="text-base font-semibold leading-snug">{a.headline}</p>}
      {a.about && <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{a.about}</p>}
      {!!a.experience?.length && (
        <ul className="mt-3 space-y-1 text-sm">
          {a.experience.slice(0, 4).map((e, i) => <li key={i}><span className="font-medium">{e.title}</span> · {e.organization}</li>)}
        </ul>
      )}
      {!!a.skills?.length && <div className="mt-3 flex flex-wrap gap-1.5">{a.skills.slice(0, 12).map((s) => <span key={s} className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs">{s}</span>)}</div>}
      <div className="mt-4 flex gap-2">
        <button onClick={() => void download()} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-foreground px-4 text-sm text-background"><Download className="size-4" />{tx('Download CV (PDF)', 'تنزيل السيرة (PDF)')}</button>
        <button onClick={() => { void navigator.clipboard?.writeText(`${a.headline ?? ''}\n\n${a.about ?? ''}`); setCopied(true); }} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border px-4 text-sm">{copied ? tx('Copied', 'تم النسخ') : tx('Copy headline + About', 'نسخ العنوان والنبذة')}</button>
      </div>
      <p className="mt-2 text-2xs text-muted-foreground">{tx('Synthetic demo data. Ask a parent to review before publishing.', 'بيانات تجريبية. اطلب من أحد الوالدين المراجعة قبل النشر.')}</p>
    </motion.div>
  );
}

