'use client';

import { memo, useMemo } from 'react';
import { useReducedMotion } from 'motion/react';
import {
  Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart, PolarAngleAxis, RadialBar, RadialBarChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { chartAnimation, chartColors, chartTheme } from '@murshid/design';
import type { ChartSpec } from '@/lib/types';

const colorOf = (spec: ChartSpec, i: number) => spec.series[i]?.color ?? chartColors[i % chartColors.length]!;

function fmt(v: unknown, unit?: string) {
  if (typeof v !== 'number') return String(v ?? '');
  const n = Math.round(v * 100) / 100;
  if (!unit) return String(n);
  if (unit === '%' || unit === '/7') return `${n}${unit}`;
  return `${n} ${unit}`;
}

/** Pure Recharts renderer for a ChartSpec. Memoized; animations off under reduced motion. */
export const ChartView = memo(function ChartView({ spec, height = 220, rtl = false, compact = false }: { spec: ChartSpec; height?: number; rtl?: boolean; compact?: boolean }) {
  const reduced = useReducedMotion();
  const anim = { ...chartAnimation, isAnimationActive: !reduced };
  const gid = (k: string) => `fill-${spec.id}-${k}`.replace(/[^a-zA-Z0-9-_]/g, '');
  const tooltip = (
    <Tooltip
      isAnimationActive={false}
      cursor={spec.type === 'line' || spec.type === 'area' ? { stroke: 'var(--border)' } : { fill: 'var(--surface-2)', radius: 8 } as never}
      contentStyle={chartTheme.tooltip.contentStyle}
      labelStyle={chartTheme.tooltip.labelStyle}
      formatter={(v, name) => [fmt(v, spec.unit), name]}
    />
  );
  const axisX = <XAxis dataKey={spec.xKey} {...chartTheme.axis} interval="preserveStartEnd" minTickGap={16} tick={{ ...chartTheme.axis.tick, fontSize: 11 }} />;
  const axisY = compact ? <YAxis hide domain={['auto', 'auto']} /> : (
    <YAxis {...chartTheme.axis} width={40} orientation={rtl ? 'right' : 'left'} tickCount={4} domain={spec.unit === '/7' ? [(d: number) => Math.max(1, Math.floor(d - 0.5)), 7] : spec.unit === '%' ? [(d: number) => Math.max(0, Math.floor((d - 3) / 5) * 5), (d: number) => Math.min(100, Math.ceil((d + 2) / 5) * 5)] : ['auto', 'auto']} tickFormatter={(v: number) => (Math.abs(v) >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10))} allowDecimals={spec.unit !== '%'} />
  );
  const grid = <CartesianGrid {...chartTheme.grid} />;
  const margin = { top: 8, right: 8, left: 0, bottom: 0 };
  const categorical = spec.type === 'pie' || spec.type === 'radial';

  const body = useMemo(() => {
    switch (spec.type) {
      case 'bar':
      case 'stacked-bar': {
        const stacked = spec.type === 'stacked-bar';
        return (
          <BarChart data={spec.data} margin={margin} barCategoryGap="30%">
            {grid}{axisX}{axisY}{tooltip}
            {spec.series.map((s, i) => (
              <Bar key={s.key} dataKey={s.key} name={s.label} fill={colorOf(spec, i)} stackId={stacked ? 'a' : undefined}
                radius={stacked ? (i === spec.series.length - 1 ? chartTheme.stackedBarTop : [0, 0, 0, 0]) : chartTheme.bar.radius}
                maxBarSize={chartTheme.bar.maxBarSize} {...anim} />
            ))}
          </BarChart>
        );
      }
      case 'line':
        return (
          <LineChart data={spec.data} margin={margin}>
            {grid}{axisX}{axisY}{tooltip}
            {spec.series.map((s, i) => (
              <Line key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colorOf(spec, i)} {...chartTheme.line} {...anim} />
            ))}
          </LineChart>
        );
      case 'area':
        return (
          <AreaChart data={spec.data} margin={margin}>
            <defs>
              {spec.series.map((s, i) => (
                <linearGradient key={s.key} id={gid(s.key)} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={colorOf(spec, i)} stopOpacity={chartTheme.area.fillOpacityTop} />
                  <stop offset="100%" stopColor={colorOf(spec, i)} stopOpacity={chartTheme.area.fillOpacityBottom} />
                </linearGradient>
              ))}
            </defs>
            {grid}{axisX}{axisY}{tooltip}
            {spec.series.map((s, i) => (
              <Area key={s.key} type="monotone" dataKey={s.key} name={s.label} stroke={colorOf(spec, i)} strokeWidth={chartTheme.area.strokeWidth} fill={`url(#${gid(s.key)})`} {...anim} />
            ))}
          </AreaChart>
        );
      case 'pie': {
        const key = spec.series[0]?.key ?? 'value';
        return (
          <PieChart>
            {tooltip}
            <Pie data={spec.data} dataKey={key} nameKey={spec.xKey} innerRadius="62%" outerRadius="92%" paddingAngle={2} cornerRadius={6} stroke="none" {...anim}>
              {spec.data.map((_, i) => <Cell key={i} fill={chartColors[i % chartColors.length]} />)}
            </Pie>
          </PieChart>
        );
      }
      case 'radial': {
        const key = spec.series[0]?.key ?? 'value';
        const data = spec.data.map((d, i) => ({ ...d, fill: chartColors[i % chartColors.length] }));
        return (
          <RadialBarChart data={data} innerRadius="28%" outerRadius="100%" startAngle={90} endAngle={-270} barCategoryGap="22%">
            <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
            {tooltip}
            <RadialBar dataKey={key} name={spec.series[0]?.label} cornerRadius={999} background={chartTheme.radial.background} {...anim} />
          </RadialBarChart>
        );
      }
      default:
        return <BarChart data={spec.data} />;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec, reduced, rtl, compact]);

  return (
    <div dir="ltr" className={categorical ? 'grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-center gap-4' : ''}>
      <div style={{ height: categorical ? Math.min(height, 260) : height }} className="w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%" debounce={100}>{body}</ResponsiveContainer>
      </div>
      {categorical ? (
        <ul dir={rtl ? 'rtl' : 'ltr'} className="space-y-2 text-sm">
          {spec.data.slice(0, 6).map((d, i) => (
            <li key={i} className="flex items-center gap-2">
              <span className="size-2.5 shrink-0 rounded-full" style={{ background: chartColors[i % chartColors.length] }} />
              <span className="min-w-0 flex-1 truncate text-muted-foreground">{String(d[spec.xKey])}</span>
              <span className="tabular font-medium">{fmt(d[spec.series[0]?.key ?? 'value'], spec.unit)}</span>
            </li>
          ))}
        </ul>
      ) : spec.series.length > 1 ? (
        <ul dir={rtl ? 'rtl' : 'ltr'} className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
          {spec.series.map((s, i) => (
            <li key={s.key} className="flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: colorOf(spec, i) }} />{s.label}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
});
