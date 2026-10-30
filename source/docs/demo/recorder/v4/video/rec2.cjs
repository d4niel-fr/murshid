// Murshid demo v4: records each scene in time with the new narration (av/vo/timing.json) and logs every
// click, keystroke, scroll and streamed agent step to clips2/<shot>.events.json, for sound and camera sync.
// Frames are captured at 2880x1440 so the compositor can zoom in without going soft.
// usage: FAKE_NOW=2026-10-15T06:00:00Z node rec2.cjs [shot,shot,...]
const { chromium } = require('playwright');
const fs = require('fs');
const { execFileSync } = require('child_process');
const V = __dirname; const OUT = `${V}/clips2`;
const WEB = 'http://localhost:3000'; const ADMIN = 'http://localhost:3001';
const FAKE = process.env.FAKE_NOW;
const SHOTS = new Set((process.argv[2] || 'title,b,g,e,f,c,d,closing').split(','));
const want = (...n) => n.some((x) => SHOTS.has(x));
const VO = JSON.parse(fs.readFileSync(`${V}/../av/vo/timing.json`, 'utf8')).scenes;
const LEAD = 0.4;
/** Scene time (s) at which line i starts, or at which `word` in it is spoken (by character share). */
const at = (s, i, word) => { const r = VO[s].lines[i]; const k = word ? r.text.indexOf(word) / r.text.length : 0; return LEAD + r.start + (r.end - r.start) * k; };
const W = 2880, H = 1440;

const PACE_JS = `(() => {
  const PACE = { 'route': 400, 'agent-start': 500, 'agent-tool': 750, 'agent-done': 600, 'meta': 150, 'done': 300 };
  const orig = window.fetch.bind(window);
  window.__sse = [];
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const res = await orig(input, init);
    const ct = res.headers.get('content-type') || '';
    if (!/\\/chat$/.test(url) || !ct.includes('text/event-stream') || !res.body) return res;
    const reader = res.body.getReader(); const enc = new TextEncoder(); const dec = new TextDecoder();
    let buf = '';
    const body = new ReadableStream({ async start(ctrl) {
      for (;;) {
        const { value, done } = await reader.read();
        if (value) buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\\n\\n')) >= 0) {
          const frame = buf.slice(0, i + 2); buf = buf.slice(i + 2);
          const ev = ((/^event: *(.+)$/m.exec(frame) || [])[1] || '').trim();
          await new Promise((r) => setTimeout(r, PACE[ev] ?? 60));
          ctrl.enqueue(enc.encode(frame));
          window.__sse.push([performance.timeOrigin + performance.now(), ev]);
        }
        if (done) { if (buf) ctrl.enqueue(enc.encode(buf)); ctrl.close(); return; }
      }
    } });
    return new Response(body, { status: res.status, headers: res.headers });
  };
})();`;

const CURSOR_JS = `(() => {
  const add = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div'); c.id = '__demo_cursor';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 10.5-6.6 1.3 3.9 7.4-3 1.5-3.9-7.5L4 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none', transition: 'transform .12s', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' });
    document.documentElement.appendChild(c);
    addEventListener('mousemove', (e) => { c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'scale(.8)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();`;

// ---------- event log (node performance clock, ms) ----------
let EV = [];
const ev = (type, o = {}) => EV.push({ t: performance.now(), type, ...o });
let VIEW = [1440, 720];  // CSS size of the page being recorded (for coordinates)

class Shot {
  constructor(page, name) { this.page = page; this.name = name; this.frames = []; }
  async start() {
    EV = [];
    this.cdp = await this.page.context().newCDPSession(this.page);
    this.cdp.on('Page.screencastFrame', (e) => { this.frames.push([performance.now(), e.data]); this.cdp.send('Page.screencastFrameAck', { sessionId: e.sessionId }).catch(() => {}); });
    await this.page.evaluate(() => { window.__sse = []; }).catch(() => {});
    await this.cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });
    this.t0 = performance.now();
  }
  /** wait until `s` seconds after the shot started */
  async until(s) { const d = this.t0 + s * 1000 - performance.now(); if (d > 0) await this.page.waitForTimeout(d); }
  async stop() {
    const tEnd = performance.now();
    await this.cdp.send('Page.stopScreencast'); await this.cdp.detach().catch(() => {});
    const sse = await this.page.evaluate(() => window.__sse || []).catch(() => []);
    for (const [epoch, name] of sse) EV.push({ t: epoch - performance.timeOrigin, type: 'sse', name });
    const d = `${OUT}/${this.name}`; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
    const fr = this.frames; const lines = [];
    fr.forEach(([t, data], i) => {
      const p = `${d}/f${String(i).padStart(5, '0')}.jpg`; fs.writeFileSync(p, Buffer.from(data, 'base64'));
      const nxt = i + 1 < fr.length ? fr[i + 1][0] : tEnd;
      lines.push(`file '${p}'\nduration ${Math.max((nxt - t) / 1000, 0.001).toFixed(4)}`);
    });
    lines.push(`file '${d}/f${String(fr.length - 1).padStart(5, '0')}.jpg'`);
    fs.writeFileSync(`${d}/list.txt`, lines.join('\n') + '\n');
    execFileSync('ffmpeg', ['-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', `${d}/list.txt`, '-vf', `scale=${W}:${H}:flags=lanczos,fps=30,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', `${OUT}/${this.name}.mp4`]);
    const base = fr[0][0];
    const events = EV.map((e) => ({ ...e, t: +((e.t - base) / 1000).toFixed(3) })).sort((a, b) => a.t - b.t);
    fs.writeFileSync(`${OUT}/${this.name}.events.json`, JSON.stringify({ view: VIEW, size: [W, H], duration: +((tEnd - base) / 1000).toFixed(3), events }, null, 1));
    fs.rmSync(d, { recursive: true, force: true });
    console.log(this.name, ((tEnd - base) / 1000).toFixed(1) + 's', fr.length, 'frames', events.length, 'events');
  }
}
async function shot(page, name, fn) { const s = new Shot(page, name); await s.start(); try { await fn(s); } finally { await s.stop(); } }

// ---------- motion helpers (all logged) ----------
const easeIO = (k) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const SCROLL_JS = ([y, ms, rel]) => new Promise((res) => {
  const p = document.getElementById('scroller'); const el = p && p.scrollHeight > p.clientHeight ? p : document.scrollingElement;
  const s = el.scrollTop; const to = rel ? s + y : y; const t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; el.scrollTop = s + (to - s) * e; if (el === document.scrollingElement) window.scrollTo(0, s + (to - s) * e); k < 1 ? requestAnimationFrame(f) : res(to - s); };
  requestAnimationFrame(f);
});
async function scrollBy(pg, y, ms) { ev('scroll', { dy: y, dur: ms / 1000 }); return pg.evaluate(SCROLL_JS, [y, ms, true]); }
async function scrollTo(pg, y, ms) { ev('scroll', { to: y, dur: ms / 1000 }); return pg.evaluate(SCROLL_JS, [y, ms, false]); }
const offsetOf = (pg, loc) => loc.evaluate((el) => { const p = document.getElementById('scroller'); const top = p && p.scrollHeight > p.clientHeight ? p.getBoundingClientRect().top : 0; return el.getBoundingClientRect().top - top; });
const CHAT_SCROLL_JS = ([target, ms]) => new Promise((res) => {
  const v = [...document.querySelectorAll('div')].filter((d) => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight && d.id !== 'scroller').pop();
  if (!v) return res(0);
  const y = target === null ? v.scrollHeight - v.clientHeight : v.scrollTop + target;
  const to = Math.max(0, Math.min(y, v.scrollHeight - v.clientHeight)); const s = v.scrollTop; const t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; v.scrollTop = s + (to - s) * e; k < 1 ? requestAnimationFrame(f) : res(to - s); };
  requestAnimationFrame(f);
});

let mouse = [640, 320];
async function glide(pg, x1, y1, ms, steps = 30) {
  const [x0, y0] = mouse; ev('move', { x0, y0, x1, y1, dur: ms / 1000 });
  for (let i = 1; i <= steps; i++) { const e = easeIO(i / steps); await pg.mouse.move(x0 + (x1 - x0) * e, y0 + (y1 - y0) * e); await pg.waitForTimeout(ms / steps); }
  mouse = [x1, y1]; ev('moveEnd', { x: x1, y: y1 });
}
async function center(loc) { const b = await loc.boundingBox(); return [b.x + b.width / 2, b.y + b.height / 2]; }
async function box(loc) { const b = await loc.boundingBox(); return [b.x, b.y, b.width, b.height]; }
async function glideTo(pg, loc, ms = 800, dx = 0, dy = 0) { const [x, y] = await center(loc); await glide(pg, x + dx, y + dy, ms); }
async function click(pg) { ev('click', { x: mouse[0], y: mouse[1] }); await pg.mouse.down(); await pg.waitForTimeout(80); await pg.mouse.up(); }
async function clickGlide(pg, loc, ms = 700) { await glideTo(pg, loc, ms); await pg.waitForTimeout(110); await click(pg); }
// human typing: ~19 chars/s with jitter, small hesitations at spaces and punctuation
let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
async function typeHuman(pg, text, base = 52) {
  for (const ch of text) {
    ev('key', { ch });
    await pg.keyboard.type(ch);
    let d = base + (rnd() - 0.5) * 34; if (ch === ' ') d += 22 + rnd() * 30; if (/[,.:;"?!]/.test(ch)) d += 55;
    await pg.waitForTimeout(Math.max(26, d));
  }
}
async function goto(pg, url, settle = 1500) { await pg.goto(url, { waitUntil: 'networkidle' }); await pg.waitForTimeout(settle); }
const mark = (name, o = {}) => ev('mark', { name, ...o });

async function context(b, w, h, dpr, extra = {}) {
  const ctx = await b.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: dpr, locale: 'en-GB', timezoneId: 'Asia/Dubai', ...extra });
  if (FAKE) await ctx.addInitScript(`(() => { const R = Date; const off = ${Date.parse(FAKE)} - R.now();
    function D(...a) { if (!new.target) return new R(R.now() + off).toString(); return a.length ? new R(...a) : new R(R.now() + off); }
    D.prototype = R.prototype; D.now = () => R.now() + off; D.parse = R.parse; D.UTC = R.UTC; Object.defineProperty(D, 'name', { value: 'Date' });
    window.Date = D; })();`);
  await ctx.addInitScript(PACE_JS);  // no page cursor: the compositor draws a smooth one from the logged moves
  await ctx.addInitScript(() => { const st = document.createElement('style'); st.textContent = '*{backdrop-filter:none!important;-webkit-backdrop-filter:none!important}'; (document.head || document.documentElement).appendChild(st); });
  return ctx;
}

// Cards are drawn frame by frame at 30 fps, full frame 1920x1080.
async function card(b, name, seconds) {
  const cctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5 });
  const pg = await cctx.newPage();
  await pg.goto(`http://localhost:8899/${name}2.html?manual`, { waitUntil: 'load' });
  await pg.waitForFunction(() => window.cardReady === true); await pg.waitForTimeout(500);
  const d = `${OUT}/${name}`; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
  const n = Math.round(seconds * 30);
  for (let f = 0; f < n; f++) { await pg.evaluate((t) => window.renderAt(t), f / 30); await pg.screenshot({ path: `${d}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 94 }); }
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', `${d}/f%05d.jpg`, '-vf', 'format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', `${OUT}/${name}.mp4`]);
  fs.rmSync(d, { recursive: true, force: true });
  console.log(name, seconds.toFixed(1) + 's', n, 'frames (stepped)');
  await cctx.close();
}

// Frame-stepped capture (heavy pages): frame(t) positions scroll and cursor for time t.
async function stepped(pg, name, seconds, frame) {
  const d = `${OUT}/${name}`; fs.rmSync(d, { recursive: true, force: true }); fs.mkdirSync(d, { recursive: true });
  const n = Math.round(seconds * 30);
  for (let f = 0; f < n; f++) { await frame(f / 30); await pg.screenshot({ path: `${d}/f${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 90 }); }
  execFileSync('ffmpeg', ['-y', '-v', 'error', '-framerate', '30', '-i', `${d}/f%05d.jpg`, '-vf', `scale=${W}:${H}:flags=lanczos,format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', `${OUT}/${name}.mp4`]);
  fs.rmSync(d, { recursive: true, force: true });
  console.log(name, seconds.toFixed(1) + 's', n, 'frames (stepped)');
}
function cursorAt(keys, t) {
  let i = 0; while (i < keys.length - 1 && t > keys[i + 1][0]) i++;
  const [t0, x0, y0] = keys[i]; const [t1, x1, y1] = keys[Math.min(i + 1, keys.length - 1)];
  const k = t1 > t0 ? Math.min(1, Math.max(0, (t - t0) / (t1 - t0))) : 1; const e = easeIO(k);
  return [x0 + (x1 - x0) * e, y0 + (y1 - y0) * e];
}

async function teacherPage(ctx) {
  const pg = await ctx.newPage();
  await goto(pg, ADMIN + '/login?demo=teacher', 500);
  await pg.waitForURL(/\/teacher/); await pg.waitForSelector('text=Class progress'); await pg.waitForTimeout(1600);
  return pg;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ args: ['--hide-scrollbars', '--font-render-hinting=none', '--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--ignore-gpu-blocklist'] });

  if (want('title')) await card(b, 'title', 21.0);

  const sctx = await context(b, 1440, 720, 2);           // student app: 2880x1440
  const web = await sctx.newPage();
  if (want('b', 'g')) {
    await goto(web, WEB + '/judges', 2500);
    await Promise.all([web.waitForURL(WEB + '/', { timeout: 30000 }), web.evaluate(() => document.querySelector('[data-testid=demo-student]')?.click())]);
    await web.waitForTimeout(2500);
  }
  // B. Ahamed's home, then he asks Murshid to plan his week.
  if (want('b')) {
    VIEW = [1440, 720];
    await goto(web, WEB + '/', 2600);
    mouse = [1010, 300]; await web.mouse.move(...mouse);
    await shot(web, 'b', async (S) => {
      await S.until(at('b', 1) + 0.1); mark('tasks'); await scrollBy(web, 290, 1300);
      await S.until(at('b', 2) - 1.3);
      await clickGlide(web, web.locator('aside a[href="/chat"], nav a[href="/chat"]').first(), 800); mark('nav');
      const ta = web.locator('textarea').first(); await ta.waitFor();
      await web.waitForTimeout(250); await clickGlide(web, ta, 500); mark('focus');
      await web.evaluate(() => { const c = document.getElementById('__demo_cursor'); if (c) c.style.display = 'none'; });
      await typeHuman(web, 'Plan my week around my mid-term and both sports', 50);
      await web.waitForTimeout(260); ev('key', { ch: 'Enter' }); mark('send'); await web.keyboard.press('Enter');
      await web.waitForSelector('[data-testid=workings]', { timeout: 60000 }); mark('workings');
      await web.waitForTimeout(500);
      ev('scroll', { dur: 1.6, chat: true }); await web.evaluate(CHAT_SCROLL_JS, [null, 1600]);
      await web.waitForTimeout(1500);
    });
  }
  // G. Guardrails on /how-it-works, stepped (the page is heavy in software rendering).
  if (want('g')) {
    VIEW = [1440, 720];
    await goto(web, WEB + '/how-it-works', 1500);
    const Hh = await web.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < Hh; y += 500) { await web.evaluate((v) => window.scrollTo(0, v), y); await web.waitForTimeout(260); }
    const target = await web.evaluate(() => { const h = [...document.querySelectorAll('h2')].find((e) => /guardrails/i.test(e.textContent || '')); return h.getBoundingClientRect().top + window.scrollY - 60; });
    await web.evaluate((v) => window.scrollTo(0, v), target); await web.waitForTimeout(900);
    const pts = [];
    for (const t of ['Consent', 'School data separation', 'Human approval', 'Audit log']) pts.push(await center(web.getByRole('heading', { name: t, exact: true }).first()));
    await web.evaluate(() => window.scrollTo(0, 0)); await web.waitForTimeout(900);
    const T = [at('g', 1) - 0.1, at('g', 2) - 0.1, at('g', 3) - 0.1, at('g', 3, 'every change') - 0.3];
    const keys = [[0, 1000, 560], [T[0] - 0.75, 1000, 560], [T[0], ...pts[0]], [T[1] - 0.75, ...pts[0]], [T[1], ...pts[1]], [T[2] - 0.75, ...pts[1]], [T[2], ...pts[2]], [T[3] - 0.75, ...pts[2]], [T[3], ...pts[3]], [16, ...pts[3]]];
    const evs = []; for (let i = 1; i < keys.length - 1; i += 2) evs.push({ t: keys[i][0], type: 'move', x0: keys[i][1], y0: keys[i][2], x1: keys[i + 1][1], y1: keys[i + 1][2], dur: keys[i + 1][0] - keys[i][0] });
    evs.push({ t: 0.3, type: 'scroll', to: target, dur: 2.3 });
    T.forEach((t, i) => evs.push({ t, type: 'mark', name: ['consent', 'separation', 'approval', 'audit'][i], x: pts[i][0], y: pts[i][1] }));
    await stepped(web, 'g', 16, async (t) => {
      const k = Math.min(1, Math.max(0, (t - 0.3) / 2.3));
      await web.evaluate((v) => window.scrollTo(0, v), Math.round(target * easeIO(k)));
      const [x, y] = cursorAt(keys, t); await web.mouse.move(x, y);
    });
    fs.writeFileSync(`${OUT}/g.events.json`, JSON.stringify({ view: VIEW, size: [W, H], duration: 16, scrollTarget: target, events: evs.sort((a, b) => a.t - b.t) }, null, 1));
  }

  const ctx = await context(b, 1280, 640, 2.25);         // teacher portal: 2880x1440
  // E. Best day for homework (before anything is posted, so the numbers match the narration).
  if (want('e', 'f')) {
    VIEW = [1280, 640];
    const pg = await teacherPage(ctx);
    if (want('e')) {
      mouse = [880, 380]; await pg.mouse.move(...mouse);
      await shot(pg, 'e', async (S) => {
        await S.until(0.3); await clickGlide(pg, pg.getByRole('tab', { name: 'Best day for homework' }), 700); mark('tab');
        await pg.waitForSelector('[data-testid=best-day]'); await pg.waitForTimeout(200);
        const rec = pg.getByText(/^Best day to set/).first();
        await scrollBy(pg, (await offsetOf(pg, rec)) - 170, 1000); await pg.waitForTimeout(150);
        await S.until(at('e', 1) - 0.35); await glideTo(pg, rec, 800, -120, 0); mark('headline', { box: await box(rec) });
        const pct = pg.locator('[data-testid=best-day] .figure').first();
        await S.until(at('e', 1, 'eighty') - 0.5); await glideTo(pg, pct, 750); mark('percent', { box: await box(pct) });
        const risk = pg.getByText(/at risk . extra support/).first();
        await S.until(at('e', 2) - 0.25); await glideTo(pg, risk, 750); mark('risk', { box: await box(risk) });
        await S.until(VO.e.duration + LEAD + 1.4);
      });
    }
    if (want('f')) {
      await scrollTo(pg, 0, 400); await pg.waitForTimeout(500);
      mouse = [880, 380]; await pg.mouse.move(...mouse);
      await shot(pg, 'f', async (S) => {
        await S.until(0.3); await clickGlide(pg, pg.getByRole('tab', { name: 'Weekly reports' }), 700); mark('tab');
        await pg.waitForSelector('text=Student reports'); await pg.waitForTimeout(300);
        const sends = pg.getByText(/sends itself/).first();
        if (await sends.count()) { await glideTo(pg, sends, 800); mark('sends', { box: await box(sends) }); }
        await S.until(at('f', 1) - 0.4);
        await scrollBy(pg, (await offsetOf(pg, pg.getByRole('tab', { name: 'Weekly reports' }))) - 60, 1400); await pg.waitForTimeout(150);
        const tbl = pg.getByText('Student reports').first(); await glideTo(pg, tbl, 800, 0, 60); mark('table', { box: await box(tbl) });
        await S.until(VO.f.duration + LEAD + 1.4);
      });
    }
    await pg.close();
  }
  // C + D. Ms. Thomas posts an assignment in the recommended window; then the trace for Ahamed.
  if (want('c', 'd')) {
    VIEW = [1280, 640];
    const pg = await teacherPage(ctx);
    await pg.getByRole('tab', { name: 'Best day for homework' }).click(); await pg.waitForSelector('[data-testid=best-day]');
    await pg.getByRole('tab', { name: 'Class progress' }).click(); await pg.waitForTimeout(900);
    if (want('c')) {
      mouse = [820, 330]; await pg.mouse.move(...mouse);
      await shot(pg, 'c', async (S) => {
        mark('header');
        await S.until(at('c', 0, 'posts') - 1.0); await clickGlide(pg, pg.getByRole('button', { name: 'Post assignment' }), 800); mark('open');
        await pg.waitForSelector('role=dialog'); mark('dialog'); await pg.waitForTimeout(350);
        await clickGlide(pg, pg.getByLabel('Title'), 450); await pg.waitForTimeout(120);
        await typeHuman(pg, 'Poem analysis: "Keeping Quiet"', 210);  // slow: every keystroke gets its own frame; sped up later
        await pg.waitForTimeout(250);
        await clickGlide(pg, pg.getByLabel('Set on'), 500); await pg.getByLabel('Set on').fill('2026-10-20'); mark('date');
        await pg.waitForTimeout(400);
        await S.until(at('c', 1, 'Murshid') - 0.9); await clickGlide(pg, pg.getByRole('button', { name: 'Post to class' }), 650); mark('post');
        const st = pg.locator('[role=status]').first(); await st.waitFor({ timeout: 30000 }); mark('posted', { box: await box(st) });
        await pg.waitForTimeout(500);
        await glideTo(pg, pg.getByText(/replanned/).first(), 850, -160, 0); mark('replanned', { box: await box(pg.getByText(/replanned/).first()) });
        await S.until(at('c', 2, 'a flag') - 0.4);
        const risk = pg.getByText(/At risk, extra support|Nobody is at risk/).first();
        await glideTo(pg, risk, 850, -140, 0); mark('risk', { box: await box(risk) });
        await S.until(VO.c.duration + LEAD + 1.5);
      });
    }
    if (want('d')) {
      await scrollTo(pg, 0, 300); await pg.waitForTimeout(400);
      await shot(pg, 'd', async (S) => {
        await S.until(0.3); await clickGlide(pg, pg.getByRole('button', { name: /How Murshid worked this out/ }).first(), 800); mark('open');
        await pg.waitForTimeout(500);
        const steps = [['1 · Goal understood', at('d', 1, 'understands')], ['2 · Steps planned', at('d', 1, 'plans')], ['3 · Tools used', at('d', 1, 'uses tools')], ['4 · Actions taken', at('d', 1, 'takes action')], ['5 · Result', at('d', 2)]];
        for (const [label, t] of steps) {
          const el = pg.getByText(label, { exact: true }).first();
          await S.until(t - 0.75);
          const off = await offsetOf(pg, el).catch(() => null);
          if (off !== null && Math.abs(off - 150) > 20) await scrollBy(pg, off - 150, 900);
          mark('step', { label, box: await box(el).catch(() => null) });
        }
        await S.until(VO.d.duration + LEAD + 1.4);
      });
    }
    await pg.close();
  }

  if (want('closing')) await card(b, 'closing', 13.6);
  await b.close();
})();
