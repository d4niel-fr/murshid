/**
 * Study tools on the server: cards, notes and explanations from a student's own material. With a model configured
 * (and inside today's budget) a model writes them; otherwise, or when the model's answer does not parse, the same
 * rule engine the app uses offline (@murshid/study) does. Every response says which one made it.
 */
import { explainCard, generateCards, generateNotes, type GenCard } from '@murshid/study';
import { z } from 'zod';
import type { Api } from '../lib/router';
import type { ChatEngine } from './chat';
import { demoView } from './routes';
import type { DemoStore } from './store';

const Generate = z.object({
  text: z.string().trim().min(20, 'paste at least a few sentences').max(60_000),
  kind: z.enum(['cards', 'notes', 'both']).default('both'),
  title: z.string().trim().max(120).optional(),
  max: z.number().int().min(1).max(60).default(30),
});
const Explain = z.object({
  front: z.string().trim().min(1).max(400),
  back: z.string().trim().min(1).max(1200),
  context: z.string().max(6000).default(''),
  style: z.enum(['simple', 'example', 'mnemonic', 'deeper']).default('simple'),
});

const ModelCards = z.object({
  cards: z.array(z.object({ front: z.string().min(1).max(300), back: z.string().min(1).max(800) })).max(60).default([]),
  notes: z.object({ title: z.string().max(120), markdown: z.string().max(20_000) }).optional(),
});

/** The first JSON object in a model reply (models sometimes wrap it in prose or code fences). */
function firstJson(text: string): unknown {
  const start = text.indexOf('{'); const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try { return JSON.parse(text.slice(start, end + 1)); } catch { return null; }
}

async function ask(engine: ChatEngine, system: string, user: string, maxTokens: number): Promise<{ text: string; model: string } | null> {
  if (!engine.provider || (engine.guard && !engine.guard.available())) return null;
  try {
    const r = await engine.provider.chat({
      model: engine.models[0]!, models: engine.models, temperature: 0.3, max_tokens: maxTokens,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    });
    const text = r.choices[0]?.message.content ?? '';
    return text ? { text, model: r.model } : null;
  } catch {
    engine.guard?.noteFallback();
    return null;
  }
}

export function registerStudy(api: Api, store: DemoStore, engine: ChatEngine) {
  api.route({
    method: 'post', path: '/study/generate', tag: 'study', auth: 'custom', durable: 'none', body: Generate,
    summary: 'Flashcards and/or structured notes from pasted material (slides, PDF text, notes); model when configured, else rules',
  }, async (c, { body }) => {
    await demoView(c, store); // a signed-in student only
    const b = body as z.output<typeof Generate>;
    const wantCards = b.kind !== 'notes'; const wantNotes = b.kind !== 'cards';
    const sys = 'You write study material for a high-school student from THEIR material only. Reply with ONE JSON object and nothing else: '
      + '{"cards":[{"front":"short question or term","back":"answer in one or two sentences"}],"notes":{"title":"...","markdown":"..."}}. '
      + 'Cards test one idea each, mix definitions, formulas, "why" questions and examples, and never invent facts that are not in the material. '
      + 'Notes use markdown: ## Summary (bullets), ## Key terms (table), then one ## section per topic with bullets, ## Check yourself (- [ ] questions). '
      + `Write up to ${b.max} cards. ${wantCards ? '' : 'Leave cards empty. '}${wantNotes ? '' : 'Leave out notes. '}Use the language of the material.`;
    const m = await ask(engine, sys, `${b.title ? `Title: ${b.title}\n\n` : ''}${b.text.slice(0, 14_000)}`, 2400);
    if (m) {
      const parsed = ModelCards.safeParse(firstJson(m.text));
      if (parsed.success && (parsed.data.cards.length || parsed.data.notes)) {
        const cards = parsed.data.cards.slice(0, b.max).map((x): GenCard => ({ front: x.front.trim(), back: x.back.trim(), kind: 'pair' }));
        return c.json({
          engine: 'model' as const, model: m.model,
          cards: wantCards ? cards : [],
          notes: wantNotes ? (parsed.data.notes ? { title: parsed.data.notes.title || b.title || 'Notes', body: parsed.data.notes.markdown } : generateNotes(b.text, b.title)) : null,
        });
      }
      engine.guard?.noteFallback();
    }
    return c.json({
      engine: 'rules' as const, model: null,
      cards: wantCards ? generateCards(b.text, { max: b.max }) : [],
      notes: wantNotes ? generateNotes(b.text, b.title) : null,
    });
  });

  api.route({
    method: 'post', path: '/study/explain', tag: 'study', auth: 'custom', durable: 'none', body: Explain,
    summary: 'Explain a flashcard: simpler, with an example, a memory hook or in more depth; model when configured, else rules',
  }, async (c, { body }) => {
    await demoView(c, store);
    const b = body as z.output<typeof Explain>;
    const how = { simple: 'Explain it like I am new to the topic, in 2-3 short sentences, with an everyday comparison.', example: 'Give one worked example or real-life example, step by step, in under 90 words.', mnemonic: 'Give one short memory hook (acronym, rhyme or image) and say how it maps to the answer.', deeper: 'Explain the idea more deeply in under 120 words: why it is true and a common mistake students make.' }[b.style];
    const m = await ask(engine, 'You are Murshid, a patient tutor for a high-school student. Plain text, no markdown headings. Stay accurate; if the card itself looks wrong, say so kindly.',
      `Flashcard\nQ: ${b.front}\nA: ${b.back}\n${b.context ? `\nThe student's notes:\n${b.context.slice(0, 3000)}\n` : ''}\n${how}`, 500);
    if (m) return c.json({ engine: 'model' as const, model: m.model, text: m.text.trim() });
    const r = explainCard(b.front, b.back, b.context);
    const text = b.style === 'example' ? (r.example ?? `Try making your own example: where would you see "${b.front}" in real life? Write it on the back of the card.`)
      : b.style === 'mnemonic' ? (r.mnemonic ?? `Link "${b.front}" to a picture: imagine it happening in the room you revise in, and say the answer out loud once.`)
      : b.style === 'deeper' ? [r.simple, ...r.related].join(' ')
      : r.simple;
    return c.json({ engine: 'rules' as const, model: null, text, related: r.related });
  });
}
