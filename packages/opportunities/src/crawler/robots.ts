/** Minimal robots.txt parser (RFC 9309 subset): User-agent groups, Allow/Disallow with * and $, Crawl-delay. */

interface Group {
  agents: string[];
  rules: Array<{ allow: boolean; pattern: string }>;
  crawlDelay?: number;
}

export interface RobotsPolicy {
  isAllowed(pathAndQuery: string): boolean;
  crawlDelaySeconds: number | null;
}

export function parseRobots(txt: string, userAgent: string): RobotsPolicy {
  const groups: Group[] = [];
  let cur: Group | null = null;
  let lastWasAgent = false;
  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, '').trim();
    if (!line) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const val = line.slice(idx + 1).trim();
    if (key === 'user-agent') {
      if (!cur || !lastWasAgent) {
        cur = { agents: [], rules: [] };
        groups.push(cur);
      }
      cur.agents.push(val.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (!cur) continue;
    if (key === 'allow' || key === 'disallow') {
      if (key === 'disallow' && val === '') continue; // empty disallow = allow all
      cur.rules.push({ allow: key === 'allow', pattern: val });
    } else if (key === 'crawl-delay') {
      const n = Number(val);
      if (!Number.isNaN(n)) cur.crawlDelay = n;
    }
  }
  const ua = userAgent.toLowerCase();
  const token = ua.split(/[/\s]/)[0] ?? ua;
  const specific = groups.filter((g) => g.agents.some((a) => a !== '*' && (token.includes(a) || ua.includes(a))));
  const chosen = specific.length ? specific : groups.filter((g) => g.agents.includes('*'));
  const rules = chosen.flatMap((g) => g.rules);
  const crawlDelay = chosen.find((g) => g.crawlDelay !== undefined)?.crawlDelay ?? null;

  const toRegex = (p: string) =>
    new RegExp('^' + p.replace(/[.+?^{}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\\\$$|\$$/, '$'));

  return {
    crawlDelaySeconds: crawlDelay,
    isAllowed(path: string) {
      let best: { allow: boolean; len: number } | null = null;
      for (const r of rules) {
        if (toRegex(r.pattern).test(path)) {
          const len = r.pattern.length;
          // longest match wins; on tie, allow wins
          if (!best || len > best.len || (len === best.len && r.allow)) best = { allow: r.allow, len };
        }
      }
      return best ? best.allow : true;
    },
  };
}
