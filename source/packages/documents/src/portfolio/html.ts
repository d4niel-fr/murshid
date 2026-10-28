import type { JsonResume } from '../jsonresume/schema.js';

export interface PortfolioOptions {
  /**
   * Public portfolios for minors hide email/phone by default. Set to true only with the student's
   * (and, under 18, guardian's) agreement.
   */
  showContact?: boolean;
  accent?: string;
  /** Short tagline under the name; defaults to basics.label. // AI-LATER: student-voiced tagline */
  tagline?: string;
}

export function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function safeUrl(u?: string): string | undefined {
  if (!u) return undefined;
  try {
    const p = new URL(u);
    return p.protocol === 'https:' || p.protocol === 'http:' || p.protocol === 'mailto:' ? p.toString() : undefined;
  } catch {
    return undefined;
  }
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function fmt(d?: string): string {
  if (!d) return '';
  const [y, m] = d.split('-');
  return m ? `${MONTHS[Number(m) - 1]} ${y}` : (y ?? '');
}

interface Card {
  title: string;
  meta?: string;
  body?: string;
  bullets?: string[];
  url?: string;
  tag?: string;
}

function cards(items: Card[]): string {
  return items
    .map((c) => {
      const link = safeUrl(c.url);
      return `<article class="card">
  <header><h3>${escapeHtml(c.title)}</h3>${c.tag ? `<span class="tag">${escapeHtml(c.tag)}</span>` : ''}</header>
  ${c.meta ? `<p class="meta">${escapeHtml(c.meta)}</p>` : ''}
  ${c.body ? `<p>${escapeHtml(c.body)}</p>` : ''}
  ${c.bullets?.length ? `<ul>${c.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>` : ''}
  ${link ? `<a class="evidence" href="${escapeHtml(link)}" rel="noopener noreferrer" target="_blank">View evidence</a>` : ''}
</article>`;
    })
    .join('\n');
}

function section(id: string, title: string, inner: string): string {
  return inner.trim() ? `<section id="${id}"><h2>${escapeHtml(title)}</h2><div class="grid">${inner}</div></section>` : '';
}

/** One-page, self-contained (inline CSS, no JS, no external assets) portfolio from a JSON Resume. */
export function renderPortfolioHtml(r: JsonResume, opts: PortfolioOptions = {}): string {
  const accent = /^#[0-9a-f]{3,8}$/i.test(opts.accent ?? '') ? opts.accent! : '#1f3a5f';
  const b = r.basics;
  const tagline = opts.tagline ?? b.label ?? '';
  const contact: string[] = [];
  if (opts.showContact && b.email) contact.push(`<a href="mailto:${escapeHtml(b.email)}">${escapeHtml(b.email)}</a>`);
  if (opts.showContact && b.phone) contact.push(escapeHtml(b.phone));
  if (b.location?.city) contact.push(escapeHtml(`${b.location.city}, UAE`));
  for (const p of b.profiles ?? []) {
    const u = safeUrl(p.url);
    if (u) contact.push(`<a href="${escapeHtml(u)}" rel="noopener noreferrer">${escapeHtml(p.network)}</a>`);
  }

  const projects = (r.projects ?? []).map<Card>((p) => ({
    title: p.name,
    meta: fmt(p.startDate),
    body: p.description,
    bullets: p.highlights,
    url: p.url,
    tag: p.type && p.type !== 'project' ? p.type : undefined,
  }));
  const experience: Card[] = [
    ...(r.work ?? []).map((w) => ({ title: w.position ? `${w.position}, ${w.name}` : w.name, meta: fmt(w.startDate), bullets: w.highlights, url: w.url })),
    ...(r.volunteer ?? []).map((v) => ({
      title: `${v.position ?? 'Volunteer'}, ${v.organization}`,
      meta: fmt(v.startDate),
      bullets: v.highlights,
      url: v.url,
      tag: 'volunteering',
    })),
  ];
  const honours: Card[] = [
    ...(r.awards ?? []).map((a) => ({ title: a.title, meta: [a.awarder, fmt(a.date)].filter(Boolean).join(' · '), body: a.summary })),
    ...(r.certificates ?? []).map((c) => ({ title: c.name, meta: [c.issuer, fmt(c.date)].filter(Boolean).join(' · '), url: c.url, tag: 'certificate' })),
  ];
  const edu = (r.education ?? []).map<Card>((e) => ({
    title: e.institution,
    meta: [e.area, e.endDate ? `Class of ${e.endDate}` : ''].filter(Boolean).join(' · '),
    body: e.score,
    bullets: e.courses,
  }));
  const chips = [
    ...(r.skills ?? []).flatMap((s) => s.keywords ?? []),
  ];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: b.name,
    description: b.summary,
    knowsLanguage: r.languages?.map((l) => l.language),
  };

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${escapeHtml(b.name)} · Portfolio</title>
<meta name="description" content="${escapeHtml(b.summary ?? '')}">
<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>
<style>
:root{--accent:${accent};--ink:#1b1f24;--muted:#5b6470;--line:#e3e6ea;--bg:#fafbfc}
*{box-sizing:border-box}body{margin:0;font:16px/1.55 system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Arabic",sans-serif;color:var(--ink);background:var(--bg)}
main{max-width:980px;margin:0 auto;padding:40px 24px 56px}
.hero{border-bottom:3px solid var(--accent);padding-bottom:20px;margin-bottom:8px}
.hero h1{font-size:2.2rem;margin:0}.hero .tagline{color:var(--accent);font-weight:600;margin:4px 0 8px}
.hero .summary{max-width:70ch;margin:8px 0}.contact{color:var(--muted);font-size:.92rem;display:flex;flex-wrap:wrap;gap:6px 16px}
.contact a{color:var(--accent)}
h2{font-size:1.05rem;text-transform:uppercase;letter-spacing:.06em;color:var(--accent);margin:28px 0 12px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px}
.card{background:#fff;border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.card header{display:flex;justify-content:space-between;gap:8px;align-items:flex-start}
.card h3{font-size:1rem;margin:0}.card p{margin:6px 0}.card ul{margin:6px 0 0;padding-left:18px}
.meta{color:var(--muted);font-size:.88rem}
.tag{font-size:.72rem;text-transform:uppercase;letter-spacing:.04em;background:color-mix(in srgb,var(--accent) 12%,#fff);color:var(--accent);padding:2px 8px;border-radius:99px;white-space:nowrap}
.chips{display:flex;flex-wrap:wrap;gap:8px;padding:0;margin:0;list-style:none}.chips li{background:#fff;border:1px solid var(--line);border-radius:99px;padding:4px 12px;font-size:.9rem}
.evidence{display:inline-block;margin-top:8px;font-size:.88rem;color:var(--accent)}
footer{margin-top:36px;color:var(--muted);font-size:.8rem}
@media print{body{background:#fff;font-size:11pt}main{padding:0}.card{break-inside:avoid;border-color:#ccc}.evidence::after{content:" (" attr(href) ")";font-size:.75em}}
</style>
</head>
<body>
<main>
<section class="hero">
  <h1>${escapeHtml(b.name)}</h1>
  ${tagline ? `<p class="tagline">${escapeHtml(tagline)}</p>` : ''}
  ${b.summary ? `<p class="summary">${escapeHtml(b.summary)}</p>` : ''}
  ${contact.length ? `<div class="contact">${contact.map((c) => `<span>${c}</span>`).join('')}</div>` : ''}
</section>
${section('projects', 'Projects & Activities', cards(projects))}
${section('experience', 'Experience', cards(experience))}
${section('honours', 'Awards & Certificates', cards(honours))}
${section('education', 'Education', cards(edu))}
${
  chips.length || r.languages?.length || r.interests?.length
    ? `<section id="skills"><h2>Skills, Languages & Interests</h2><ul class="chips">${[
        ...chips,
        ...(r.languages ?? []).map((l) => l.language),
        ...(r.interests ?? []).map((i) => i.name),
      ]
        .map((c) => `<li>${escapeHtml(c)}</li>`)
        .join('')}</ul></section>`
    : ''
}
<footer>Made with Murshid · Last updated ${escapeHtml(fmt(r.meta?.lastModified?.slice(0, 7)))}</footer>
</main>
</body>
</html>
`;
}
