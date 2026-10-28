import asyncio, re, sys
from playwright.async_api import async_playwright
from rec import Shot, browser

BASE = 'http://localhost:3000'
ADMIN = 'http://localhost:3001'
CARDS = 'file:///workspace/work/demo/cards'

SCROLL_JS = """([y, ms]) => new Promise(res => { const s = window.scrollY, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2;
    window.scrollTo(0, s + (y - s) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); })"""
async def scroll_to(pg, y, ms): await pg.evaluate(SCROLL_JS, [y, ms])
async def el_top(pg, sel, margin=24):
    return await pg.evaluate(f"(() => {{ const e = [...document.querySelectorAll({sel!r})].pop(); return e ? e.getBoundingClientRect().top + window.scrollY - {margin} : 0; }})()")

async def goto(pg, url, settle=1800):
    await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(settle)

async def glide(pg, x0, y0, x1, y1, ms, steps=40):
    await pg.mouse.move(x0, y0)
    for i in range(1, steps + 1):
        await pg.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await pg.wait_for_timeout(ms / steps)

async def card(ctx, name, ms):
    pg = await ctx.new_page()
    await pg.set_content('<body style="margin:0;background:#f7f6f2"></body>'); await pg.wait_for_timeout(200)
    async with Shot(pg, name):
        await pg.goto(f'{CARDS}/{name}.html', wait_until='load')
        await pg.wait_for_timeout(ms)
    await pg.close()

async def scene_a(ctx): await card(ctx, 'title', 10600)
async def scene_g(ctx): await card(ctx, 'closing', 11000)

async def scene_b(ctx):
    pg = await ctx.new_page()
    await goto(pg, BASE + '/')
    async with Shot(pg, 'b1'):
        await pg.wait_for_timeout(1800); await scroll_to(pg, 230, 2200); await pg.wait_for_timeout(2000)
    for name, area in [('b2', 'football'), ('b3', 'swimming'), ('b4', 'academics')]:
        await goto(pg, f'{BASE}/insights?area={area}&range=year', 2200)
        top = await el_top(pg, '.card', 16)
        await pg.evaluate(f'window.scrollTo(0, {top} - 60)'); await pg.wait_for_timeout(600)
        async with Shot(pg, name):
            await scroll_to(pg, top, 900)
            await glide(pg, 330, 520, 1180, 470, 3600)
            await pg.wait_for_timeout(500)
    await pg.close()

async def chat(pg, text, wait_ms, delay=32):
    box = pg.locator('textarea').first
    await box.click()
    await pg.evaluate("(() => { const c = document.getElementById('__demo_cursor'); if (c) c.style.display = 'none'; })()")
    await pg.keyboard.type(text, delay=delay)
    await pg.wait_for_timeout(350)
    await pg.keyboard.press('Enter')
    await pg.wait_for_timeout(wait_ms)

async def scroll_chat_bottom(pg, ms=1500):
    await pg.evaluate("""(ms) => new Promise(res => { const v = [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight).pop();
      if (!v) return res(); const s = v.scrollTop, y = v.scrollHeight - v.clientHeight, t0 = performance.now();
      const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2; v.scrollTop = s + (y - s) * e; k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); })""", ms)


CHAT_SCROLL_JS = """([text, offset, ms]) => new Promise(res => {
  const v = [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight).pop();
  if (!v) return res(false);
  let y;
  if (text === null) y = v.scrollHeight - v.clientHeight;
  else if (typeof text === 'number') y = v.scrollTop + text;
  else { const el = [...v.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.includes(text))).pop(); if (!el) return res(false);
    const card = el.closest('.card') || el; y = v.scrollTop + card.getBoundingClientRect().top - v.getBoundingClientRect().top - offset; }
  y = Math.max(0, Math.min(y, v.scrollHeight - v.clientHeight));
  const s = v.scrollTop, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2; v.scrollTop = s + (y - s) * e; k < 1 ? requestAnimationFrame(f) : res(true); }; requestAnimationFrame(f); })"""
async def chat_scroll(pg, target, offset=16, ms=1500): return await pg.evaluate(CHAT_SCROLL_JS, [target, offset, ms])

async def scene_c(ctx):
    pg = await ctx.new_page()
    await goto(pg, BASE + '/chat')
    async with Shot(pg, 'c'):
        await pg.wait_for_timeout(700)
        await chat(pg, 'Plan my week around my mid-term and both sports', 0)
        await pg.wait_for_selector('text=Your week plan', timeout=20000)
        await pg.wait_for_timeout(500)
        await chat_scroll(pg, 'Your week plan', 12, 1600)
        await pg.wait_for_timeout(2200)
        await chat_scroll(pg, 330, 0, 2800)
        await pg.wait_for_timeout(2200)
    await pg.close()

async def scene_d(ctx):
    pg = await ctx.new_page()
    await goto(pg, BASE + '/chat')
    async with Shot(pg, 'd'):
        await pg.wait_for_timeout(300)
        await chat(pg, 'Find opportunities for Tideline and save the best one', 0, 22)
        await pg.wait_for_selector('text=Young Founders Pitch Night', timeout=20000)
        await pg.wait_for_timeout(1500)
        await chat_scroll(pg, None, 0, 1600)
        await pg.wait_for_timeout(2600)
    await pg.close()

async def scene_e(ctx):
    pg = await ctx.new_page()
    await goto(pg, BASE + '/chat')
    async with Shot(pg, 'e1'):
        await pg.wait_for_timeout(300)
        await chat(pg, 'Generate my LinkedIn CV', 0, 30)
        await pg.wait_for_selector('text=Download CV (PDF)', timeout=20000)
        await pg.wait_for_timeout(1200)
        await chat_scroll(pg, 'Download CV (PDF)', 380, 1400)
        await pg.wait_for_timeout(1600)
    pdf = await (await pg.request.get('http://localhost:8787/student/cv/linkedin.pdf', headers={'x-dev-user': 'demo-ideal'})).body()
    open('/workspace/work/demo/cards/cv.pdf', 'wb').write(pdf)
    import subprocess; subprocess.run(['pdftoppm', '-png', '-r', '240', '-f', '1', '-l', '1', '-singlefile', '/workspace/work/demo/cards/cv.pdf', '/workspace/work/demo/cards/cv'], check=True)
    await pg.goto(f'{CARDS}/cv.html', wait_until='load'); await pg.wait_for_timeout(500)
    async with Shot(pg, 'e2'):
        await pg.evaluate("document.querySelector('.page').classList.add('go')")
        await pg.wait_for_timeout(4200)
    await pg.close()

async def click_glide(pg, loc, frm, ms=700):
    bb = await loc.bounding_box(); x, y = bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2
    await glide(pg, frm[0], frm[1], x, y, ms, 22); await pg.wait_for_timeout(120); await loc.click()
    return (x, y)

async def scene_f(ctx):
    pg = await ctx.new_page()
    await goto(pg, ADMIN + '/students/demo-ideal', 2000)
    async with Shot(pg, 'f1'):
        await pg.wait_for_timeout(700)
        p = await click_glide(pg, pg.get_by_role('tab', name=re.compile('Tasks')), (900, 300), 800)
        await pg.wait_for_timeout(700)
        p = await click_glide(pg, pg.get_by_role('button', name='Task', exact=True), p, 700)
        await pg.wait_for_timeout(600)
        await pg.get_by_label('Title').click(); await pg.keyboard.type('Hand in Economics essay draft', delay=24)
        await pg.get_by_label('Due date').fill(TODAY); await pg.get_by_label('Time').fill('16:00')
        await pg.get_by_label('Notes').click(); await pg.keyboard.type("Before tomorrow's mid-term.", delay=16)
        await pg.wait_for_timeout(300)
        await click_glide(pg, pg.get_by_role('button', name='Save', exact=True), (640, 400), 600)
        await pg.wait_for_timeout(700)
        await pg.evaluate("""() => { const td = [...document.querySelectorAll('td')].find(t => t.textContent.includes('Hand in Economics essay draft')); const tr = td && td.closest('tr');
          if (tr) { tr.scrollIntoView({ behavior: 'smooth', block: 'center' }); tr.style.transition = 'background .6s'; tr.style.background = 'rgba(48,83,200,.12)'; } }""")
        await pg.wait_for_timeout(2000)
    pg2 = await ctx.new_page()
    await goto(pg2, BASE + '/', 1800)
    async with Shot(pg2, 'f2'):
        row = pg2.get_by_text('Hand in Economics essay draft').first
        bb = await row.bounding_box()
        await glide(pg2, 900, 650, bb['x'] + 120, bb['y'] + bb['height'] / 2, 900, 25)
        await pg2.wait_for_timeout(3800)
    await pg.close(); await pg2.close()

# The API's world runs on today's Dubai date, so the admin task must be due today to land on the student's list.
import datetime, zoneinfo
TODAY = datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Dubai')).date().isoformat()

async def main(which):
    async with async_playwright() as p:
        b, ctx = await browser(p)
        for s in which: await globals()[f'scene_{s}'](ctx)
        await b.close()

asyncio.run(main(sys.argv[1:]))
