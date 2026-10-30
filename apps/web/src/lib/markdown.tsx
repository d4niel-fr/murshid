import { Fragment, type ReactNode } from 'react';

/**
 * A small, safe Markdown renderer for notes: headings, bold, italic, inline code, links (http/https/mailto only),
 * lists, checklists, quotes, tables, rules, code blocks and `front :: back` flashcard lines.
 * It builds React elements (never raw HTML), so a note can't inject markup or scripts.
 */
export interface Heading { id: string; text: string; level: 2 | 3 }

export const slug = (s: string) => s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'section';

export function headings(md: string): Heading[] {
  const out: Heading[] = []; const seen = new Map<string, number>(); let inCode = false;
  for (const line of md.split('\n')) {
    if (line.startsWith('```')) inCode = !inCode;
    if (inCode) continue;
    const m = /^(#{2,3})\s+(.+)$/.exec(line);
    if (m) { const base = slug(m[2]!); const n = seen.get(base) ?? 0; seen.set(base, n + 1); out.push({ id: n ? `${base}-${n}` : base, text: m[2]!.trim(), level: m[1]!.length as 2 | 3 }); }
  }
  return out;
}

function inline(text: string, key = 'i'): ReactNode[] {
  const out: ReactNode[] = []; let rest = text; let k = 0;
  const re = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\))/;
  while (rest) {
    const m = re.exec(rest);
    if (!m) { out.push(rest); break; }
    if (m.index) out.push(rest.slice(0, m.index));
    const tok = m[0]; const id = `${key}-${k++}`;
    if (tok.startsWith('**')) out.push(<strong key={id}>{inline(tok.slice(2, -2), id)}</strong>);
    else if (tok.startsWith('`')) out.push(<code key={id} className="md-code">{tok.slice(1, -1)}</code>);
    else if (tok.startsWith('[')) {
      const lm = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(tok)!;
      const href = lm[2]!; const safe = /^(https?:|mailto:|\/)/i.test(href);
      out.push(safe ? <a key={id} href={href} {...(href.startsWith('/') ? {} : { target: '_blank', rel: 'noopener noreferrer' })} className="md-link">{lm[1]}</a> : lm[1]);
    } else out.push(<em key={id}>{inline(tok.slice(1, -1), id)}</em>);
    rest = rest.slice(m.index + tok.length);
  }
  return out;
}

export function Markdown({ source, onToggleTask }: { source: string; onToggleTask?: (line: number) => void }) {
  const lines = source.replace(/\r/g, '').split('\n');
  const blocks: ReactNode[] = []; const seen = new Map<string, number>();
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    if (!line.trim()) { i++; continue; }
    if (line.startsWith('```')) {
      const body: string[] = []; i++;
      while (i < lines.length && !lines[i]!.startsWith('```')) body.push(lines[i++]!);
      i++; blocks.push(<pre key={`b${i}`} className="md-pre"><code>{body.join('\n')}</code></pre>); continue;
    }
    const h = /^(#{1,3})\s+(.+)$/.exec(line);
    if (h) {
      const level = Math.max(2, h[1]!.length); const base = slug(h[2]!); const n = seen.get(base) ?? 0; seen.set(base, n + 1);
      const Tag = (level === 2 ? 'h2' : 'h3') as 'h2' | 'h3';
      blocks.push(<Tag key={`b${i}`} id={n ? `${base}-${n}` : base} className={level === 2 ? 'md-h2' : 'md-h3'}>{inline(h[2]!)}</Tag>); i++; continue;
    }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { blocks.push(<hr key={`b${i}`} className="md-hr" />); i++; continue; }
    if (line.startsWith('>')) {
      const body: string[] = [];
      while (i < lines.length && lines[i]!.startsWith('>')) body.push(lines[i++]!.replace(/^>\s?/, ''));
      blocks.push(<blockquote key={`b${i}`} className="md-quote">{inline(body.join(' '))}</blockquote>); continue;
    }
    if (line.trim().startsWith('|') && lines[i + 1]?.includes('---')) {
      const row = (l: string) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
      const head = row(line); i += 2; const rows: string[][] = [];
      while (i < lines.length && lines[i]!.trim().startsWith('|')) rows.push(row(lines[i++]!));
      blocks.push(
        <div key={`b${i}`} className="md-table-wrap"><table className="md-table">
          <thead><tr>{head.map((c, j) => <th key={j} scope="col">{inline(c)}</th>)}</tr></thead>
          <tbody>{rows.map((r, ri) => <tr key={ri}>{r.map((c, j) => <td key={j}>{inline(c)}</td>)}</tr>)}</tbody>
        </table></div>,
      ); continue;
    }
    if (/^\s*([-*]|\d+\.)\s+/.test(line)) {
      const ordered = /^\s*\d+\./.test(line); const items: ReactNode[] = [];
      while (i < lines.length && /^\s*([-*]|\d+\.)\s+/.test(lines[i]!)) {
        const raw = lines[i]!.replace(/^\s*([-*]|\d+\.)\s+/, ''); const task = /^\[( |x|X)\]\s+(.*)$/.exec(raw); const at = i;
        items.push(task
          ? <li key={i} className="md-task"><input type="checkbox" checked={task[1] !== ' '} readOnly={!onToggleTask} onChange={() => onToggleTask?.(at)} aria-label={task[2]} /><span>{inline(task[2]!)}</span></li>
          : <li key={i}>{inline(raw)}</li>);
        i++;
      }
      blocks.push(ordered ? <ol key={`b${i}`} className="md-ol">{items}</ol> : <ul key={`b${i}`} className="md-ul">{items}</ul>); continue;
    }
    const card = /^(.+?)\s::\s(.+)$/.exec(line);
    if (card) { blocks.push(<p key={`b${i}`} className="md-card"><span>{inline(card[1]!)}</span><span aria-hidden>→</span><span>{inline(card[2]!)}</span></p>); i++; continue; }
    const para: string[] = [];
    while (i < lines.length && lines[i]!.trim() && !/^(#{1,3}\s|>|```|\s*([-*]|\d+\.)\s|\|)/.test(lines[i]!)) para.push(lines[i++]!);
    if (!para.length) { para.push(lines[i++]!); }
    blocks.push(<p key={`b${i}`} className="md-p">{para.map((p, j) => <Fragment key={j}>{j > 0 && <br />}{inline(p, `p${i}-${j}`)}</Fragment>)}</p>);
  }
  return <div className="md">{blocks}</div>;
}
