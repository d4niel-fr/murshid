/**
 * Dependency-free MIME parser sufficient for LMS notification emails:
 * header unfolding, RFC 2047 encoded-words, multipart/* recursion,
 * base64 + quoted-printable, utf-8 / latin1 / windows-1252 charsets.
 */
export interface MimePart {
  headers: Record<string, string>;
  contentType: string;
  params: Record<string, string>;
  body: string; // decoded text for text/*, raw for others
  parts: MimePart[];
}

export interface ParsedEmail {
  from: string;
  fromAddress: string;
  to: string;
  subject: string;
  date: Date | null;
  messageId: string | null;
  text: string;
  html: string | null;
  headers: Record<string, string>;
}

function splitHeaderBody(raw: string): [string, string] {
  const norm = raw.replace(/\r\n/g, '\n');
  const idx = norm.indexOf('\n\n');
  return idx === -1 ? [norm, ''] : [norm.slice(0, idx), norm.slice(idx + 2)];
}

export function parseHeaders(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const unfolded = block.replace(/\n[ \t]+/g, ' ');
  for (const line of unfolded.split('\n')) {
    const i = line.indexOf(':');
    if (i <= 0) continue;
    const k = line.slice(0, i).trim().toLowerCase();
    const v = line.slice(i + 1).trim();
    if (!(k in out)) out[k] = v; // keep first (top-most) occurrence
  }
  return out;
}

export function parseParams(value: string): { value: string; params: Record<string, string> } {
  const [main = '', ...rest] = value.split(';');
  const params: Record<string, string> = {};
  for (const r of rest) {
    const i = r.indexOf('=');
    if (i > 0) params[r.slice(0, i).trim().toLowerCase()] = r.slice(i + 1).trim().replace(/^"|"$/g, '');
  }
  return { value: main.trim().toLowerCase(), params };
}

function decodeBytes(buf: Buffer, charset = 'utf-8'): string {
  const cs = charset.toLowerCase();
  if (cs === 'utf-8' || cs === 'utf8' || cs === 'us-ascii') return buf.toString('utf8');
  try {
    return new TextDecoder(cs).decode(buf);
  } catch {
    return buf.toString('latin1');
  }
}

export function decodeQuotedPrintable(s: string): Buffer {
  const soft = s.replace(/=\r?\n/g, '');
  const bytes: number[] = [];
  for (let i = 0; i < soft.length; i++) {
    const ch = soft[i]!;
    if (ch === '=' && /^[0-9A-Fa-f]{2}$/.test(soft.slice(i + 1, i + 3))) {
      bytes.push(parseInt(soft.slice(i + 1, i + 3), 16));
      i += 2;
    } else {
      for (const b of Buffer.from(ch, 'utf8')) bytes.push(b);
    }
  }
  return Buffer.from(bytes);
}

/** RFC 2047: =?charset?B|Q?text?= */
export function decodeEncodedWords(v: string): string {
  return v
    .replace(/\?=\s+=\?/g, '?==?')
    .replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, cs: string, enc: string, txt: string) => {
      const buf = enc.toUpperCase() === 'B' ? Buffer.from(txt, 'base64') : decodeQuotedPrintable(txt.replace(/_/g, ' '));
      return decodeBytes(buf, cs);
    });
}

export function parsePart(raw: string, depth = 0): MimePart {
  const [hb, body] = splitHeaderBody(raw);
  const headers = parseHeaders(hb);
  const ct = parseParams(headers['content-type'] ?? 'text/plain; charset=utf-8');
  const part: MimePart = { headers, contentType: ct.value, params: ct.params, body: '', parts: [] };
  if (ct.value.startsWith('multipart/') && ct.params.boundary && depth < 10) {
    const b = `--${ct.params.boundary}`;
    const chunks = body.split(b).slice(1);
    for (const chunk of chunks) {
      if (chunk.startsWith('--')) break;
      part.parts.push(parsePart(chunk.replace(/^\n/, ''), depth + 1));
    }
    return part;
  }
  const cte = (headers['content-transfer-encoding'] ?? '7bit').toLowerCase();
  let buf: Buffer;
  if (cte === 'base64') buf = Buffer.from(body.replace(/\s+/g, ''), 'base64');
  else if (cte === 'quoted-printable') buf = decodeQuotedPrintable(body);
  else buf = Buffer.from(body, 'utf8');
  part.body = ct.value.startsWith('text/') ? decodeBytes(buf, ct.params.charset) : buf.toString('base64');
  return part;
}

function findFirst(p: MimePart, type: string): MimePart | null {
  if (p.contentType === type && !/attachment/i.test(p.headers['content-disposition'] ?? '')) return p;
  for (const c of p.parts) {
    const f = findFirst(c, type);
    if (f) return f;
  }
  return null;
}

export function extractAddress(from: string): string {
  const m = /<([^>]+)>/.exec(from);
  return (m ? m[1]! : from).trim().toLowerCase();
}

export function parseEmail(raw: string, htmlToText: (h: string) => string): ParsedEmail {
  const root = parsePart(raw);
  const h = root.headers;
  const textPart = findFirst(root, 'text/plain');
  const htmlPart = findFirst(root, 'text/html');
  const html = htmlPart?.body ?? null;
  const from = decodeEncodedWords(h.from ?? '');
  const date = h.date ? new Date(h.date) : null;
  return {
    from,
    fromAddress: extractAddress(from),
    to: decodeEncodedWords(h.to ?? ''),
    subject: decodeEncodedWords(h.subject ?? ''),
    date: date && !isNaN(date.getTime()) ? date : null,
    messageId: h['message-id'] ?? null,
    text: textPart?.body ?? (html ? htmlToText(html) : ''),
    html,
    headers: h,
  };
}
