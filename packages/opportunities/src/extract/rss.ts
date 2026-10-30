import * as cheerio from 'cheerio';
import type { Opportunity, Source } from '../types.js';
import { cleanText } from '../util.js';
import { buildOpportunity, type RawItem } from './build.js';

/** Parse RSS 2.0 / Atom into RawItems. */
export function parseFeed(xml: string): RawItem[] {
  const $ = cheerio.load(xml, { xmlMode: true });
  const items: RawItem[] = [];
  $('item, entry').each((_, el) => {
    const $el = $(el);
    const title = cleanText($el.children('title').text());
    const link = cleanText($el.children('link').text()) || $el.children('link').attr('href') || '';
    const descHtml = $el.children('description').text() || $el.children('content\\:encoded').text() || $el.children('summary, content').text();
    const text = cleanText(cheerio.load(descHtml).root().text());
    const cats = $el.children('category').map((__, c) => cleanText($(c).text()).toLowerCase()).get();
    if (title && link) items.push({ title, url: link, text: cats.length ? `${text} ${cats.join(' ')}` : text });
  });
  return items;
}

export function extractFromFeed(xml: string, source: Source, now: Date): Opportunity[] {
  return parseFeed(xml).map((r) => buildOpportunity(r, source, { now }));
}
