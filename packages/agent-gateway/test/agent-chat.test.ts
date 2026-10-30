import { describe, expect, it } from 'vitest';
import { AgentChat, DEFAULT_AREAS, MockProvider, RuleChatProvider, V1_CHAT_TOOLS, parseIntent, type AreaVocab } from '../src/index.js';

const subjects: AreaVocab[] = [
  { id: 'maths', label: 'Mathematics', aliases: ['maths', 'math', 'الرياضيات'] },
  { id: 'further-maths', label: 'Further Maths', aliases: ['further maths'] },
  { id: 'physics', label: 'Physics', labelAr: 'الفيزياء', aliases: ['physics', 'الفيزياء'] },
  { id: 'goal-100m', label: '100m under 13s', aliases: ['100m goal'] },
];

describe('parseIntent (rules)', () => {
  it('detects progress with area and range (English)', () => {
    const r = parseIntent('How is my gym going this term?');
    expect(r).toMatchObject({ intent: 'progress', lang: 'en', areas: ['gym'], range: 'term', rangeExplicit: true });
    expect(parseIntent('show me athletics for the past year')).toMatchObject({ intent: 'progress', areas: ['athletics'], range: 'year' });
    expect(parseIntent('hackathons last 12 weeks')).toMatchObject({ intent: 'progress', areas: ['hackathon'], range: '12w' });
  });
  it('defaults to 4 weeks and matches student subjects, preferring the longest alias', () => {
    const all = [...DEFAULT_AREAS, ...subjects];
    expect(parseIntent('progress in physics', all)).toMatchObject({ intent: 'progress', areas: ['physics'], range: '4w', rangeExplicit: false });
    expect(parseIntent('how am I doing in further maths', all).areas).toEqual(['further-maths']);
  });
  it('detects compare', () => {
    expect(parseIntent('compare athletics and gym this month')).toMatchObject({ intent: 'compare', areas: ['athletics', 'gym'], range: '4w' });
    expect(parseIntent('gym vs robotics')).toMatchObject({ intent: 'compare', areas: ['gym', 'robotics'] });
  });
  it('detects upcoming, tasks and opportunities', () => {
    expect(parseIntent("what's coming up next week?").intent).toBe('upcoming');
    expect(parseIntent('any exams soon?').intent).toBe('upcoming');
    expect(parseIntent('what should I do today').intent).toBe('tasks');
    expect(parseIntent('show my overdue tasks')).toMatchObject({ intent: 'tasks', taskScope: 'overdue' });
    expect(parseIntent('find me a summer program')).toMatchObject({ intent: 'opportunities', opportunityType: 'summer_program' });
    expect(parseIntent('any competitions for me?')).toMatchObject({ intent: 'opportunities', opportunityType: 'competition' });
  });
  it('understands simple Arabic', () => {
    expect(parseIntent('كيف تقدمي في الرياضيات هذا الفصل؟', [...DEFAULT_AREAS, ...subjects])).toMatchObject({ intent: 'progress', lang: 'ar', areas: ['maths'], range: 'term' });
    expect(parseIntent('قارن بين الجري والنادي')).toMatchObject({ intent: 'compare', lang: 'ar', areas: ['athletics', 'gym'] });
    expect(parseIntent('ما هي المواعيد القادمة؟')).toMatchObject({ intent: 'upcoming', lang: 'ar' });
    expect(parseIntent('ما هي مهامي اليوم')).toMatchObject({ intent: 'tasks', lang: 'ar' });
    expect(parseIntent('أريد فرص تطوع')).toMatchObject({ intent: 'opportunities', opportunityType: 'volunteering' });
  });
  it('greets and falls back', () => {
    expect(parseIntent('hello!').intent).toBe('greeting');
    expect(parseIntent('مرحبا').intent).toBe('greeting');
    expect(parseIntent('tell me a joke').intent).toBe('unknown');
  });
});

describe('AgentChat over the rule provider', () => {
  it('returns text + parsed tool calls in the OpenAI tool-call shape', async () => {
    const provider = new RuleChatProvider();
    const chat = new AgentChat({ provider });
    const t = await chat.turn({ message: 'How is physics going this term?', studentName: 'Sara', areas: subjects });
    expect(t).toMatchObject({ intent: 'progress', lang: 'en', provider: 'rules' });
    expect(t.toolCalls).toEqual([{ name: 'render_chart', args: { area: 'physics', range: 'term' } }]);
    expect(t.text).toMatch(/Physics/);
  });
  it('answers Arabic with Arabic area names', async () => {
    const t = await new AgentChat().turn({ message: 'كيف تقدمي في الفيزياء هذا الفصل؟', studentName: 'سارة', areas: subjects });
    expect(t).toMatchObject({ intent: 'progress', lang: 'ar', toolCalls: [{ name: 'render_chart', args: { area: 'physics', range: 'term' } }] });
    expect(t.text).toContain('الفيزياء');
    const u = await new AgentChat().turn({ message: 'ما هي المواعيد القادمة؟', studentName: 'سارة' });
    expect(u.toolCalls).toEqual([{ name: 'show_tasks', args: { scope: 'upcoming' } }]);
  });
  it('sends the tool list and the student areas to the provider', async () => {
    const seen: unknown[] = [];
    const provider = new RuleChatProvider();
    const spy = { name: 'spy', chat: async (req: Parameters<RuleChatProvider['chat']>[0]) => { seen.push(req); return provider.chat(req); } };
    const t = await new AgentChat({ provider: spy }).turn({ message: 'compare maths and physics', studentName: 'Sara', areas: subjects });
    const req = seen[0] as { tools: unknown[]; messages: { role: string; content: string }[] };
    expect(req.tools).toEqual(V1_CHAT_TOOLS);
    expect(req.messages[0]!.content).toContain('- physics | Physics / الفيزياء | physics');
    expect(t.toolCalls[0]).toMatchObject({ name: 'render_chart', args: { areas: ['maths', 'physics'], compare: true } });
  });
  it('works with any provider (a plain model reply yields text only)', async () => {
    const t = await new AgentChat({ provider: new MockProvider([{ reply: 'Keep going!' }]) }).turn({ message: 'hi', studentName: 'Sara' });
    expect(t).toMatchObject({ text: 'Keep going!', toolCalls: [], provider: 'mock' });
  });
  it('drops malformed or unknown tool calls from a model', async () => {
    const bad = {
      name: 'bad',
      chat: async () => ({
        id: 'x', object: 'chat.completion' as const, created: 0, model: 'm',
        choices: [{ index: 0, finish_reason: 'tool_calls' as const, message: { role: 'assistant' as const, content: 'ok', tool_calls: [
          { id: '1', type: 'function' as const, function: { name: 'render_chart', arguments: '{oops' } },
          { id: '2', type: 'function' as const, function: { name: 'delete_everything', arguments: '{}' } },
          { id: '3', type: 'function' as const, function: { name: 'show_tasks', arguments: '{"scope":"today"}' } },
        ] } }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    };
    const t = await new AgentChat({ provider: bad }).turn({ message: 'x', studentName: 'S' });
    expect(t.toolCalls).toEqual([{ name: 'show_tasks', args: { scope: 'today' } }]);
  });
});
