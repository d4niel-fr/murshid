/**
 * Murshid's study engine, without a model: turns pasted text, notes, slides or a PDF's text into flashcards, a quiz
 * and structured notes, and grades typed answers. Pure functions, shared by the app (works offline) and the API
 * (which uses a model when one is configured and falls back to these rules).
 */

export type CardKind = 'pair' | 'definition' | 'formula' | 'list' | 'cloze' | 'term';
export interface GenCard { front: string; back: string; kind: CardKind }
export interface Section { heading: string; lines: string[] }

/* ------------------------------------------------------------------ text */

const STOP = new Set(('a an the and or but if then so of to in on at by for from with without into onto over under about as is are was were be been being '
  + 'it its this that these those there their they them he she his her we our you your i me my not no yes can could should would will shall may might must '
  + 'do does did done has have had having which who whom whose what when where why how than too very also just only more most less least such each every '
  + 'some any all both either neither one two three first second third new other another same own up down out off again further once here many much few '
  + 'used use using called known like e.g i.e etc per via change changes increase decrease example examples people number value result results '
  + 'effect effects thing things way ways part parts time times level levels amount type types form forms case cases main important').split(' '));

/** Tidy text from a PDF or slides: join hyphenated breaks, drop page numbers and repeated blank lines. */
export function cleanText(raw: string): string {
  return raw
    .replace(/\r\n?/g, '\n')
    .replace(/­/g, '')
    .replace(/([a-z])-\n([a-z])/g, '$1$2')
    .replace(/ {2,}/g, ' ')
    .split('\n').map((l) => l.trim()).filter((l) => !/^(page )?\d{1,3}( of \d{1,3})?$/i.test(l))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Split one run of prose into sentences, keeping abbreviations and decimals together. */
function splitProse(flat: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < flat.length; i++) {
    const ch = flat[i]!;
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    const next = flat[i + 1]; const after = flat[i + 2];
    if (next !== undefined && next !== ' ') continue; // 3.5, e.g.x
    const prevWord = flat.slice(start, i).split(' ').pop() ?? '';
    if (/^(e\.g|i\.e|etc|vs|dr|mr|mrs|ms|fig|eq|no|approx|st)$/i.test(prevWord)) continue;
    if (after !== undefined && /[a-z]/.test(after)) continue;
    out.push(flat.slice(start, i + 1).trim()); start = i + 2;
  }
  const rest = flat.slice(start).trim();
  if (rest) out.push(rest);
  return out;
}

/**
 * Sentences. Line breaks matter: a heading, a bullet or a line that ends a sentence stands alone; a line that wraps
 * (the next starts in lower case, as in PDFs) joins the next one.
 */
export function sentences(text: string): string[] {
  const lines = text.split('\n').map((l) => l.trim());
  const runs: string[] = [];
  let cur = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i]!;
    if (!l) { if (cur) runs.push(cur); cur = ''; continue; }
    cur = cur ? `${cur} ${l}` : l;
    const next = lines[i + 1] ?? '';
    const wraps = next && !/[.!?:;]$/.test(l) && /^[a-z(]/.test(next) && !/^([•▪◦●]|[-*]\s|\d{1,2}[.)]\s)/.test(next);
    if (!wraps) { runs.push(cur); cur = ''; }
  }
  if (cur) runs.push(cur);
  return runs.flatMap((r) => splitProse(r.replace(/\s+/g, ' '))).filter((x) => x.length > 3);
}

/** A sentence a summary or cloze can use: ends like a sentence, long enough, not a bullet or a formula line. */
const prose = (s: string) => /[.!?]$/.test(s) && s.split(/\s+/).length >= 6 && !/^([•▪◦●]|[-*]\s|\d{1,2}[.)]\s)/.test(s) && !/\s=\s/.test(s);

const words = (s: string) => s.toLowerCase().match(/[a-z؀-ۿ][a-z؀-ۿ'’-]*/g) ?? [];
const content = (s: string) => words(s).filter((w) => w.length > 2 && !STOP.has(w));
const cap = (s: string) => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const trimEnd = (s: string) => s.replace(/[\s,;:]+$/, '').trim();
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9؀-ۿ]+/g, ' ').trim();

/** Headings and the lines under them (markdown, numbered, ALL CAPS, short title lines, slide titles). */
export function outline(text: string): Section[] {
  const lines = text.split('\n').map((l) => l.trim());
  const out: Section[] = [];
  let cur: Section = { heading: '', lines: [] };
  const isHeading = (l: string, next?: string) => {
    if (/^#{1,4}\s+\S/.test(l)) return true;
    if (/^(slide|chapter|unit|topic|section)\s+\d+[:.)-]?/i.test(l)) return true;
    if (l.length < 3 || l.length > 70 || /[.?!,;:]$/.test(l)) return false;
    if (/^[-*•▪◦]\s/.test(l)) return false;
    if (/^[A-Z0-9][A-Z0-9 &/'’()-]{2,}$/.test(l) && /[A-Z]{3}/.test(l)) return true; // ALL CAPS
    const ws = l.split(/\s+/);
    if (ws.length > 8 || !next) return false;
    const caps = ws.filter((w) => /^[A-Z0-9]/.test(w)).length;
    // a short line before bullets, or a Title Case line before a longer one
    return (BULLET.test(next) && /^[A-Z0-9]/.test(l)) || (caps >= Math.ceil(ws.length * 0.5) && next.length > l.length);
  };
  const nextLine = (i: number) => lines.slice(i + 1).find((x) => x) ?? undefined;
  lines.forEach((l, i) => {
    if (!l) return;
    if (isHeading(l, nextLine(i))) {
      if (cur.heading || cur.lines.length) out.push(cur);
      cur = { heading: l.replace(/^#{1,4}\s+/, '').replace(/^(slide|chapter|unit|topic|section)\s+\d+[:.)-]?\s*/i, '').trim() || l, lines: [] };
    } else cur.lines.push(l);
  });
  if (cur.heading || cur.lines.length) out.push(cur);
  return out;
}

const BULLET = /^([•▪◦●]\s*|[-*]\s+|\d{1,2}[.)]\s+|[a-z][.)]\s+)/;
const unbullet = (l: string) => l.replace(BULLET, '').replace(/\*\*(.+?)\*\*/g, '$1').replace(/__(.+?)__/g, '$1').trim();

/** The terms that matter most in a text: bold words, defined terms, repeated multi-word names, frequent words. */
export function keyTerms(text: string, max = 12): string[] {
  const score = new Map<string, number>();
  const add = (t: string, n: number) => { const k = t.trim(); if (k.length < 3 || k.length > 48 || STOP.has(k.toLowerCase())) return; score.set(k, (score.get(k) ?? 0) + n); };
  for (const m of text.matchAll(/\*\*(.+?)\*\*|__(.+?)__/g)) add(m[1] ?? m[2] ?? '', 6);
  for (const s of sentences(text)) {
    const d = definition(s); if (d) add(d.front, 5);
    // capitalised runs that are not the first word: "Newton's Second Law", "Market Failure"
    for (const m of s.slice(1).matchAll(/\b([A-Z][a-z’']+(?:\s+(?:of|and|the|de)?\s*[A-Z][a-z’']+){1,4})\b/g)) add(m[1]!, 2);
  }
  const freq = new Map<string, number>();
  for (const w of content(text)) if (w.length > 4) freq.set(w, (freq.get(w) ?? 0) + 1);
  for (const [w, n] of freq) if (n >= 3) add(w, n * 0.6);
  // drop a term that is part of a longer chosen one
  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  const out: string[] = [];
  for (const t of ranked) {
    if (out.some((o) => o.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(o.toLowerCase()))) continue;
    out.push(t); if (out.length >= max) break;
  }
  return out;
}

/* ------------------------------------------------------------------ cards */

const DEF_VERBS = /\s(is|are|was|were|means|refers to|is defined as|are defined as|is known as|describes|represents|measures|occurs when|happens when|states that|says that)\s/i;

/** "Momentum is the product of mass and velocity." -> momentum / the product of mass and velocity */
export function definition(sentence: string): GenCard | null {
  const s = sentence.replace(/\*\*/g, '').replace(/^([•▪◦●]\s*|[-*]\s+|\d{1,2}[.)]\s+)/, '').trim();
  if (s.length < 12 || s.length > 320 || /\?$/.test(s)) return null;
  // reversed: "The speed reached when drag equals weight is called terminal velocity."
  const rev = /^(.{8,200}?)\s+(?:is|are)\s+(?:called|known as|termed)\s+(?:an?\s+|the\s+)?([^,.;]{2,50})[.!]?$/i.exec(s);
  if (rev) return { front: cap(trimEnd(rev[2]!)), back: cap(trimEnd(rev[1]!.replace(/^(the|a|an)\s+/i, (m) => m))), kind: 'definition' };
  const m = DEF_VERBS.exec(s);
  if (!m || m.index < 2) return null;
  let term = s.slice(0, m.index).replace(/^(the|a|an)\s+/i, '').trim();
  const rest = s.slice(m.index + m[0].length).replace(/[.!]$/, '').trim();
  if (term.split(/\s+/).length > 6 || /^(it|this|that|these|those|there|they|he|she|we|you|i|which|what|one|each)$/i.test(term)) return null;
  if (/\b(not|also|often|usually|sometimes|then|so)$/i.test(term)) return null;
  if (rest.length < 6 || content(rest).length < 2) return null;
  if (/^(very|quite|too|so|more|less|not)\b/i.test(rest)) return null; // "The test is very hard."
  term = term.replace(/[,:;]$/, '');
  // "Pollution is an example of a negative externality" asks the other way round
  const ex = /^(?:an?|one|a good|a common)\s+example of\s+(.+)$/i.exec(rest);
  if (ex) return { front: `An example of ${trimEnd(ex[1]!)}`, back: cap(term), kind: 'definition' };
  const verb = m[1]!.toLowerCase();
  const back = verb === 'occurs when' || verb === 'happens when' ? `When ${rest}` : verb === 'states that' || verb === 'says that' ? `It says that ${rest}` : verb === 'measures' || verb === 'describes' || verb === 'represents' ? `It ${verb} ${rest}` : rest;
  return { front: cap(term), back: cap(back), kind: 'definition' };
}

/** "Momentum: p = mv" or "Momentum (p = mv)" -> a formula card. */
function formula(line: string): GenCard | null {
  const l = unbullet(line);
  const m = /^([A-Za-z][A-Za-z’' -]{2,40}?)\s*(?:[:–—-]|\(|is given by|equals)\s*\(?([A-Za-zα-ωΔ∑√][\w\s²³⁻¹/^*·×+\-()√∆Δ.]{0,40}\s=\s[^.;]{1,60})\)?\.?$/.exec(l);
  if (m) return { front: `${cap(trimEnd(m[1]!))} (formula)`, back: m[2]!.trim(), kind: 'formula' };
  return null;
}

/** "term :: meaning", "term - meaning", "term: meaning", or tab-separated (Quizlet / Anki exports). */
export function pairsFromText(text: string): GenCard[] {
  const out: GenCard[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim(); if (!line) continue;
    let p: string[] | null = null;
    if (line.includes('\t')) p = line.split('\t');
    else if (line.includes('::')) p = line.split('::');
    else if (/^[^:]{2,60}\s[–—-]\s.{3,}$/.test(unbullet(line))) p = unbullet(line).split(/\s[–—-]\s/);
    if (!p || p.length < 2) continue;
    const front = unbullet(p[0]!); const back = p.slice(1).join(' ').trim();
    if (front && back && front.length <= 200 && back.length <= 600) out.push({ front, back, kind: 'pair' });
  }
  return out;
}

/** Score sentences for how central they are (shared content words, numbers, terms; early ones a little more). */
function rankSentences(list: string[], terms: string[]): { s: string; score: number; i: number }[] {
  const tf = new Map<string, number>();
  for (const s of list) for (const w of new Set(content(s))) tf.set(w, (tf.get(w) ?? 0) + 1);
  const lowTerms = terms.map((t) => t.toLowerCase());
  return list.map((s, i) => {
    const cw = content(s); if (cw.length < 4) return { s, score: 0, i };
    let score = cw.reduce((a, w) => a + Math.log(1 + (tf.get(w) ?? 0)), 0) / Math.sqrt(cw.length);
    if (/\d/.test(s)) score += 0.6;
    for (const t of lowTerms) if (s.toLowerCase().includes(t)) score += 1.2;
    if (/\b(important|key|main|because|therefore|causes|results in|leads to)\b/i.test(s)) score += 0.6;
    if (/^(it|this|these|they|that|those|he|she)\b/i.test(s)) score *= 0.5; // needs the sentence before it
    score += Math.max(0, 1 - i / Math.max(8, list.length)) * 0.5;
    if (s.length > 260) score *= 0.6;
    return { s, score, i };
  });
}

/** A fill-in-the-blank card from a sentence: the key term (or a number) becomes the blank. */
function cloze(s: string, terms: string[]): GenCard | null {
  if (s.length < 30 || s.length > 240) return null;
  const hit = terms.find((t) => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i').test(s));
  if (hit) {
    const re = new RegExp(`\\b${hit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    const found = re.exec(s)!;
    if (found.index === 0 && s.length - hit.length < 25) return null;
    return { front: s.replace(re, '_____'), back: found[0], kind: 'cloze' };
  }
  const num = /\b\d+(?:\.\d+)?\s?(?:%|kg|m\/s²?|n|j|w|km|cm|mm|years?|°c|aed)?\b/i.exec(s);
  if (num && !/^\d{4}$/.test(num[0])) return { front: s.replace(num[0], '_____'), back: num[0], kind: 'cloze' };
  return null;
}

/**
 * Flashcards from any study material. Order of trust: pairs the student wrote (term :: meaning, Quizlet/Anki
 * exports), then definitions, formulas, lists under a heading, then fill-in-the-blank cards from key sentences.
 */
export function generateCards(raw: string, opts: { max?: number; cloze?: boolean } = {}): GenCard[] {
  const max = opts.max ?? 30;
  const text = cleanText(raw);
  const out: GenCard[] = [];
  const seen = new Set<string>();
  const push = (c: GenCard | null) => {
    if (!c) return;
    const k = norm(c.front);
    if (!k || seen.has(k) || norm(c.back) === k) return;
    seen.add(k); out.push({ front: c.front.slice(0, 220), back: c.back.slice(0, 600), kind: c.kind });
  };
  const pairs = pairsFromText(text);
  pairs.forEach(push);
  // mostly a pasted deck already: keep it as it is
  if (pairs.length >= 4 && pairs.length >= text.split('\n').filter(Boolean).length * 0.6) return out.slice(0, Math.max(max, pairs.length));

  const lines = text.split('\n');
  for (const l of lines) push(formula(l));
  // "Term: what it means" lines (not pairs already taken)
  for (const l of lines) {
    const u = unbullet(l);
    const m = /^([A-Z][^:]{1,50}):\s+(.{8,400})$/.exec(u);
    if (m && m[1]!.split(/\s+/).length <= 6 && !/\s=\s/.test(m[2]!)) push({ front: m[1]!.trim(), back: cap(m[2]!.trim()), kind: 'definition' });
  }
  const sents = sentences(text.split('\n').filter((l) => !BULLET.test(l) || l.length > 60 || /[.!?]$/.test(l)).join('\n'));
  const used = new Set<string>();
  for (const s of sents) { const d = definition(s); if (d) { used.add(s); push(d); } }
  for (const sec of outline(text)) {
    const bullets = sec.lines.filter((l) => BULLET.test(l)).map(unbullet).filter((b) => b.length > 2 && b.length < 140);
    // a list of full definitions is already covered by definition cards
    const defined = bullets.filter((x) => definition(x)).length;
    if (sec.heading && bullets.length >= 2 && bullets.length <= 8 && defined < bullets.length / 2 && bullets.every((x) => x.length <= 110)) {
      push({ front: `${cap(sec.heading)}: the ${bullets.length} key points`, back: bullets.map((b) => `• ${b}`).join('\n'), kind: 'list' });
    }
  }
  if (opts.cloze !== false && out.length < max) {
    const terms = keyTerms(text, 16);
    const ranked = rankSentences(sents.filter(prose), terms).sort((a, b) => b.score - a.score);
    for (const r of ranked) { if (out.length >= max) break; if (r.score > 0.8 && !used.has(r.s)) push(cloze(r.s, terms)); }
    // key terms that still have no card: front = term, back = its best sentence
    for (const t of terms) {
      if (out.length >= max) break;
      if (!/\s/.test(t) && !/^[A-Z]/.test(t)) continue; // a lone common word is not a term

      if (out.some((c) => c.front.toLowerCase().includes(t.toLowerCase()) || c.back.toLowerCase() === t.toLowerCase())) continue;
      const best = ranked.find((r) => r.s.toLowerCase().includes(t.toLowerCase()) && r.s.length < 240);
      if (best) push({ front: cap(t), back: best.s, kind: 'term' });
    }
  }
  return out.slice(0, max);
}

/* ------------------------------------------------------------------ notes */

/** The most central sentences, in their original order. */
export function summarise(raw: string, n = 4): string[] {
  const text = cleanText(raw);
  const list = sentences(text.split('\n').filter((l) => !/^#/.test(l)).join('\n')).filter(prose);
  if (list.length <= n) return list;
  const ranked = rankSentences(list, keyTerms(text, 10)).sort((a, b) => b.score - a.score).slice(0, n);
  return ranked.sort((a, b) => a.i - b.i).map((r) => r.s);
}

/**
 * Structured notes from material: a summary, key terms with their meaning, the outline, formulas, questions to check
 * yourself and a flashcard section (term :: meaning lines the app turns into a deck).
 */
export function generateNotes(raw: string, title?: string): { title: string; body: string } {
  const text = cleanText(raw);
  const secs = outline(text);
  const name = (title?.trim() || secs.find((s) => s.heading)?.heading || sentences(text)[0]?.slice(0, 60) || 'Notes').replace(/[.:]$/, '');
  const cards = generateCards(text, { max: 24 });
  const defs = cards.filter((c) => (c.kind === 'definition' || c.kind === 'pair' || c.kind === 'term') && !/^An example of /.test(c.front)).slice(0, 10);
  const formulas = cards.filter((c) => c.kind === 'formula');
  const parts: string[] = [];
  const sum = summarise(text, 4);
  if (sum.length) parts.push(`## Summary\n\n${sum.map((s) => `- ${s}`).join('\n')}`);
  if (defs.length) parts.push(`## Key terms\n\n| Term | Meaning |\n|---|---|\n${defs.map((d) => `| ${d.front.replace(/\|/g, '/')} | ${d.back.replace(/\n/g, ' ').replace(/\|/g, '/')} |`).join('\n')}`);
  if (formulas.length) parts.push(`## Formulas\n\n${formulas.map((f) => `- **${f.front.replace(/ \(formula\)$/, '')}:** ${f.back}`).join('\n')}`);
  const withHeadings = secs.filter((s) => s.heading && s.lines.length);
  if (withHeadings.length >= 2) {
    parts.push(withHeadings.slice(0, 10).map((s) => {
      const bullets = s.lines.filter((l) => BULLET.test(l)).map(unbullet);
      const pts = bullets.length ? bullets.slice(0, 6) : summarise(s.lines.join('\n'), 2);
      return `## ${cap(s.heading)}\n\n${pts.map((p) => `- ${p}`).join('\n')}`;
    }).join('\n\n'));
  }
  const ask = (c: GenCard) => {
    if (c.kind === 'formula') { const f = c.front.replace(/ \(formula\)$/, ''); return `What is the formula for ${/^[A-Z]{2,}/.test(f) ? f : f.toLowerCase()}?`; }
    const list = /^(.*): the (\d+) key points$/.exec(c.front);
    if (list) return `Can you list the ${list[2]} key points of ${list[1]!.toLowerCase()}?`;
    if (/^An example of /.test(c.front)) return `Give ${c.front.charAt(0).toLowerCase()}${c.front.slice(1)}.`;
    const t = /^[A-Z]{2,}|^[A-Z][a-z]+'s\b/.test(c.front) ? c.front : c.front.charAt(0).toLowerCase() + c.front.slice(1);
    const plural = /[^s]s$/i.test(t.split(' ').pop() ?? '') && !/(ics|ness|sis|us|ss)$/i.test(t);
    return plural ? `What are ${t}?` : `What is meant by ${t}?`;
  };
  const qs = cards.filter((c) => c.kind !== 'cloze').slice(0, 5).map(ask);
  if (qs.length) parts.push(`## Check yourself\n\n${qs.map((q) => `- [ ] ${q}`).join('\n')}`);
  const fc = cards.filter((c) => c.kind !== 'list').slice(0, 16);
  if (fc.length) parts.push(`## Flashcards\n\n${fc.map((c) => `${c.front.replace(/::/g, ':')} :: ${c.back.replace(/\n/g, ' ').replace(/::/g, ':')}`).join('\n')}`);
  return { title: name.slice(0, 80), body: parts.join('\n\n') || text.slice(0, 4000) };
}

/* ------------------------------------------------------------------ quiz */

export type QType = 'mc' | 'tf' | 'type';
export interface Question { cardId: string; type: QType; prompt: string; answer: string; options?: string[]; statement?: string; truth?: boolean }
interface QCard { id: string; front: string; back: string }

/** A small deterministic random (so a quiz can be replayed from its seed). */
export function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) % 1_000_000) / 1_000_000; };
}
export function shuffle<T>(xs: T[], rand: () => number): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j]!, a[i]!]; }
  return a;
}

/** Wrong options that look like the right one: similar length and the same kind (formulas with formulas). */
export function distractors(card: QCard, pool: QCard[], n: number, rand: () => number): string[] {
  const isF = /=/.test(card.back);
  const others = pool.filter((c) => c.id !== card.id && norm(c.back) !== norm(card.back));
  const scored = others.map((c) => ({ c, d: Math.abs(c.back.length - card.back.length) / Math.max(20, card.back.length) + (/=/.test(c.back) === isF ? 0 : 1) + rand() * 0.4 }));
  return scored.sort((a, b) => a.d - b.d).slice(0, n).map((x) => x.c.back);
}

/** Questions from cards: multiple choice, true/false and typed answers, mixed. */
export function buildQuiz(cards: QCard[], opts: { count?: number; types?: QType[]; seed?: number } = {}): Question[] {
  const rand = rng(opts.seed ?? Date.now());
  const types = opts.types?.length ? opts.types : (['mc', 'mc', 'tf', 'type'] as QType[]);
  const pick = shuffle(cards, rand).slice(0, opts.count ?? Math.min(12, cards.length));
  return pick.map((c, i) => {
    let type = types[i % types.length]!;
    if (type === 'mc' && cards.length < 3) type = 'tf';
    if (type === 'tf' && cards.length < 2) type = 'type';
    if (type === 'mc') {
      const opts2 = shuffle([c.back, ...distractors(c, cards, 3, rand)], rand);
      return { cardId: c.id, type, prompt: c.front, answer: c.back, options: opts2 };
    }
    if (type === 'tf') {
      const truth = rand() < 0.5;
      const shown = truth ? c.back : distractors(c, cards, 1, rand)[0] ?? c.back;
      return { cardId: c.id, type, prompt: c.front, answer: c.back, statement: shown, truth: shown === c.back };
    }
    return { cardId: c.id, type, prompt: c.front, answer: c.back };
  });
}

/* ------------------------------------------------------------------ grading typed answers */

function lev(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length; const n = b.length; if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j]! + 1, cur[j - 1]! + 1, prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n]!;
}
const answerForm = (s: string) => s.toLowerCase().replace(/^(the|a|an)\s+/, '').replace(/[^a-z0-9؀-ۿ=+\-*/^×.²³]+/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Grade a typed answer: "right" (exact or a small typo), "close" (the key words are there) or "wrong".
 * Long answers are compared by their key words, so the student need not match the wording.
 */
export function checkAnswer(given: string, expected: string): { verdict: 'right' | 'close' | 'wrong'; note?: string } {
  const g = answerForm(given); const e = answerForm(expected);
  if (!g) return { verdict: 'wrong' };
  if (g === e) return { verdict: 'right' };
  const short = e.length <= 40;
  if (short) {
    const d = lev(g, e); const ratio = 1 - d / Math.max(e.length, g.length);
    if (ratio >= 0.86 || (e.length <= 6 && d <= 1)) return { verdict: 'right', note: 'typo' };
    if (ratio >= 0.7) return { verdict: 'close' };
    if (e.split(' ').length > 1 && g.length >= 3 && e.includes(g)) return { verdict: 'close' };
    return { verdict: 'wrong' };
  }
  const key = [...new Set(content(expected))];
  const have = new Set(content(given));
  const hit = key.filter((k) => have.has(k) || [...have].some((h) => h.length > 4 && lev(h, k) <= 1)).length;
  const share = key.length ? hit / key.length : 0;
  if (share >= 0.6) return { verdict: 'right' };
  if (share >= 0.35) return { verdict: 'close' };
  return { verdict: 'wrong' };
}

/* ------------------------------------------------------------------ explain (no model) */

export interface Explanation { simple: string; example?: string; mnemonic?: string; related: string[] }

/**
 * A plain explanation of a card from the card itself and the student's own material: the definition said shortly,
 * an example line from their notes when there is one, and a memory hook for lists.
 */
export function explainCard(front: string, back: string, context = ''): Explanation {
  const first = sentences(back)[0] ?? back;
  const short = first.length > 160 ? `${first.slice(0, 157).replace(/\s+\S*$/, '')}…` : first;
  const term = front.replace(/ \(formula\)$/, '').replace(/: the \d+ key points$/, '');
  const simple = /=/.test(back)
    ? `${term} is worked out with ${back.trim()}. Put the numbers you know into the right side to get it.`
    : `${term}, in short: ${short.charAt(0).toLowerCase()}${short.slice(1)}`;
  const ctx = sentences(cleanText(context));
  const low = term.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  const related = ctx.filter((s) => low.some((w) => s.toLowerCase().includes(w)) && norm(s) !== norm(back)).slice(0, 3);
  const example = ctx.find((s) => /\b(for example|e\.g\.|such as|for instance|example)\b/i.test(s) && low.some((w) => s.toLowerCase().includes(w)));
  const items = back.split('\n').map((l) => l.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
  const mnemonic = items.length >= 3 ? `Take the first letters: ${items.map((i) => i[0]!.toUpperCase()).join(' ')} (${items.map((i) => i.split(/\s+/)[0]).join(', ')}).` : undefined;
  return { simple, ...(example ? { example } : {}), ...(mnemonic ? { mnemonic } : {}), related };
}

/* ------------------------------------------------------------------ XP */

/** XP needed to finish level `n` (1-based): grows gently. */
export const xpForLevel = (n: number) => 100 + (n - 1) * 50;
/** Level and progress inside it, from total XP. */
export function levelOf(xp: number): { level: number; into: number; need: number } {
  let level = 1; let left = Math.max(0, Math.floor(xp));
  while (left >= xpForLevel(level)) { left -= xpForLevel(level); level++; }
  return { level, into: left, need: xpForLevel(level) };
}
