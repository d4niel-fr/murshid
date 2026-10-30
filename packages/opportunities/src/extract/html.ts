import * as cheerio from 'cheerio';
import type { Opportunity, Source } from '../types.js';
import { absoluteUrl, cleanText } from '../util.js';
import { buildOpportunity, type RawItem } from './build.js';

type Root = cheerio.CheerioAPI;

const NOISE = 'script, style, noscript, svg, iframe, nav, header, footer, form, .cookie, #cookie, [aria-hidden="true"]';

function pageTitle($: Root): string {
  const h1 = cleanText($('main h1, article h1, h1').first().text());
  const og = cleanText($('meta[property="og:title"]').attr('content'));
  const title = cleanText($('title').first().text()).split(/\s+[|–-]\s+/)[0] ?? '';
  const generic = /^(about|about us|home|overview|welcome|programs?|programmes?|news|apply|register|details|faq)$/i;
  return [h1, og, title].find((x) => x.length >= 4 && !generic.test(x)) ?? h1 ?? '';
}

const NOISE_TOKEN = /^(?:site-|main-|primary-|top-|mega-?|mobile-)?(?:nav|navbar|navigation|menu|menubar|breadcrumbs?|footer|header|sidebar|cookies?|cookie-\w+|consent|social|share|search|skip-link|newsletter|subscribe)$/i;

function isNoise(cls: string): boolean {
  return cls.split(/\s+/).some((tok) => NOISE_TOKEN.test(tok));
}

function mainText($: Root): string {
  const $$ = cheerio.load($.html());
  $$(NOISE).remove();
  $$('body [class], body [id]').each((_, el) => {
    const $el = $$(el);
    if (['main', 'article'].includes(el.tagName)) return;
    if (isNoise(`${$el.attr('class') ?? ''} ${$el.attr('id') ?? ''}`)) $el.remove();
  });
  for (const sel of ['main', 'article', '[role="main"]', '#content', '.content', '#main', '.main-content']) {
    const txt = cleanText($$(sel).first().text());
    if (txt.length >= 300) return txt;
  }
  return cleanText($$('body').text());
}

/** Extract RawItems from HTML using per-source CSS rules, falling back to a page-level item. */
export function extractRawItems(html: string, source: Source, pageUrl: string = source.url): RawItem[] {
  const $ = cheerio.load(html);
  const rules = source.rules ?? {};

  // Container split mode, e.g. AUS outreach hub: blocks separated by <hr>.
  if (rules.container && rules.split) {
    const items: RawItem[] = [];
    $(rules.container).each((_, el) => {
      const inner = $(el).html() ?? '';
      const chunks = inner.split(new RegExp(`<${rules.split}\\s*/?>`, 'i'));
      for (const chunk of chunks) {
        const $$ = cheerio.load(`<div>${chunk}</div>`);
        const title = cleanText($$(rules.title ?? 'strong, h2, h3, h4').first().text());
        if (!title) continue;
        if (rules.requireText && !new RegExp(rules.requireText, 'i').test($$.root().text())) continue;
        const href = $$(rules.link ?? 'a[href]').first().attr('href');
        items.push({ title, url: absoluteUrl(href, pageUrl), text: cleanText($$.root().text()), inheritSourceTags: false });
      }
    });
    if (items.length) return items;
  }

  // Item (card) mode.
  if (rules.item) {
    const items: RawItem[] = [];
    $(rules.item).each((_, el) => {
      const $el = $(el);
      const title = cleanText($el.find(rules.title ?? 'h2, h3, h4, a').first().text());
      if (!title) return;
      if (rules.requireText && !new RegExp(rules.requireText, 'i').test($el.text())) return;
      const href = $el.find(rules.link ?? 'a[href]').first().attr('href');
      const desc = rules.description ? $el.find(rules.description).text() : $el.text();
      const dl = rules.deadline ? cleanText($el.find(rules.deadline).text()) : '';
      items.push({ title, url: absoluteUrl(href, pageUrl), text: cleanText(`${desc} ${dl ? `Deadline: ${dl}` : ''}`), inheritSourceTags: false });
    });
    if (items.length) return items;
  }

  // Generic: the page itself is one opportunity.
  return [{ title: pageTitle($) || source.name, url: pageUrl, text: mainText($) }];
}

export function extractFromHtml(html: string, source: Source, now: Date, pageUrl?: string): Opportunity[] {
  return extractRawItems(html, source, pageUrl).map((r) =>
    buildOpportunity(r, source, { now, eventDateAsDeadline: source.rules?.eventDateAsDeadline }),
  );
}
