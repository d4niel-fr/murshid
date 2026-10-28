"""Murshid demo v3: recorded from the LIVE deployment (murshid-web / murshid-admin on Vercel).
Order: problem -> student plan -> teacher posts work -> "How Murshid worked this out" -> best day for homework ->
weekly reports -> privacy and consent -> close. Output clips: /workspace/work/demo3/clips/<shot>.mp4
Shots can be re-recorded selectively: SHOTS=b1,b2,e,f,g (default: all). Student clips use a taller window (rec3.STUDENT).
Run: CHROMIUM=<chromium> PYTHONPATH=<python playwright> python3 scenes_v3.py
"""
import asyncio, datetime, re, zoneinfo
from playwright.async_api import async_playwright
import os
from rec3 import Shot, browser, context, WEB, ADMIN, STUDENT

CARDS = 'file:///workspace/murshid/docs/demo/recorder/v3/cards'

SCROLL_JS = """([y, ms]) => new Promise(res => { const s = window.scrollY, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2;
    window.scrollTo(0, s + (y - s) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); })"""
async def scroll_to(pg, y, ms): await pg.evaluate(SCROLL_JS, [y, ms])

CHAT_SCROLL_JS = """([text, offset, ms]) => new Promise(res => {
  const v = [...document.querySelectorAll('div')].filter(d => getComputedStyle(d).overflowY === 'auto' && d.scrollHeight > d.clientHeight).pop();
  if (!v) return res(false);
  let y;
  if (text === null) y = v.scrollHeight - v.clientHeight;
  else if (typeof text === 'number') y = v.scrollTop + text;
  else { const el = [...v.querySelectorAll('*')].filter(e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.includes(text))).pop(); if (!el) return res(false);
    y = v.scrollTop + el.getBoundingClientRect().top - v.getBoundingClientRect().top - offset; }
  y = Math.max(0, Math.min(y, v.scrollHeight - v.clientHeight));
  const s = v.scrollTop, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2; v.scrollTop = s + (y - s) * e; k < 1 ? requestAnimationFrame(f) : res(true); }; requestAnimationFrame(f); })"""
async def chat_scroll(pg, target, offset=16, ms=1500): return await pg.evaluate(CHAT_SCROLL_JS, [target, offset, ms])

async def goto(pg, url, settle=1500):
    await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(settle)

async def glide(pg, x0, y0, x1, y1, ms, steps=30):
    await pg.mouse.move(x0, y0)
    for i in range(1, steps + 1):
        await pg.mouse.move(x0 + (x1 - x0) * i / steps, y0 + (y1 - y0) * i / steps); await pg.wait_for_timeout(ms / steps)
    return (x1, y1)

async def center(loc):
    bb = await loc.bounding_box(); return bb['x'] + bb['width'] / 2, bb['y'] + bb['height'] / 2

async def glide_to(pg, loc, frm, ms=800):
    x, y = await center(loc); return await glide(pg, frm[0], frm[1], x, y, ms, 24)

async def click_glide(pg, loc, frm, ms=700):
    p = await glide_to(pg, loc, frm, ms); await pg.wait_for_timeout(120); await loc.click(); return p

async def card(ctx, name, ms):
    pg = await ctx.new_page()
    await pg.set_content('<body style="margin:0;background:#f7f6f2"></body>'); await pg.wait_for_timeout(200)
    async with Shot(pg, name):
        await pg.goto(f'{CARDS}/{name}.html', wait_until='load')
        await pg.wait_for_timeout(ms)
    await pg.close()

def next_weekday(wd):  # 0 = Monday, in Dubai; strictly after today
    d = datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Dubai')).date() + datetime.timedelta(days=1)
    while d.weekday() != wd: d += datetime.timedelta(days=1)
    return d
# The posted task sits in the week after the best-day window, so the recommendation shown later is unchanged.
SET = next_weekday(0) + datetime.timedelta(days=7); DUE = SET + datetime.timedelta(days=2)

SHOTS = set(filter(None, os.environ.get('SHOTS', 'title,b1,b2,c,d,e,f,g,closing').split(',')))
def want(*names): return any(n in SHOTS for n in names)

async def teacher_page(ctx):
    pg = await ctx.new_page()
    await goto(pg, ADMIN + '/login?demo=teacher', 500)
    await pg.wait_for_url(re.compile(r'/teacher')); await pg.wait_for_selector('text=Class progress'); await pg.wait_for_timeout(1200)
    return pg

async def main():
    async with async_playwright() as p:
        b, ctx = await browser(p)                 # teacher/admin + cards: 1280x640 @1.5
        sctx = await context(b, *STUDENT)         # student app: 1440x720 @4/3 (taller, no sidebar overlap)
        # A. problem
        if want('title'): await card(ctx, 'title', 17600)

        # B. student: one-click demo login, then "plan my week"
        web = await sctx.new_page()
        if want('b1', 'b2'):
            await goto(web, WEB + '/judges', 1200)
            async with Shot(web, 'b1'):
                await web.wait_for_timeout(300)
                await click_glide(web, web.locator('[data-testid=demo-student]'), (720, 585), 900)
                await web.wait_for_url(WEB + '/'); await web.wait_for_timeout(2600)
            await goto(web, WEB + '/chat', 1200)
            async with Shot(web, 'b2'):
                box = web.locator('textarea').first
                await box.click()
                await web.evaluate("(() => { const c = document.getElementById('__demo_cursor'); if (c) c.style.display = 'none'; })()")
                await web.keyboard.type('Plan my week around my mid-term and both sports', delay=26)
                await web.wait_for_timeout(250); await web.keyboard.press('Enter')
                await web.wait_for_selector('[data-testid=workings]', timeout=60000)
                await web.wait_for_timeout(700)
                await chat_scroll(web, None, 0, 1800)
                await web.wait_for_timeout(2000)

        # C. teacher posts work (one-click teacher demo). NOTE: posting writes to the live demo data.
        if want('c', 'd'):
            pg = await teacher_page(ctx)
            if want('c'):
                async with Shot(pg, 'c'):
                    await pg.wait_for_timeout(400)
                    await click_glide(pg, pg.get_by_role('button', name='Post assignment'), (800, 380), 800)
                    await pg.wait_for_selector('role=dialog'); await pg.wait_for_timeout(300)
                    await pg.get_by_label('Title').click(); await pg.keyboard.type('Poem analysis: "Keeping Quiet"', delay=24)
                    await pg.get_by_label('Instructions').click(); await pg.keyboard.type('300 words, two quotations.', delay=16)
                    await pg.get_by_label('Set on').fill(SET.isoformat())
                    await pg.get_by_label('Due').fill(DUE.isoformat())
                    await pg.wait_for_timeout(300)
                    await click_glide(pg, pg.get_by_role('button', name='Post to class'), (640, 420), 700)
                    await pg.wait_for_selector('role=status', timeout=30000); await pg.wait_for_timeout(600)
                    await glide_to(pg, pg.get_by_text(re.compile('replanned')).first, (900, 300), 900)
                    await pg.wait_for_timeout(3200)
            # D. how Murshid worked this out (the replan trace)
            if want('d'):
                async with Shot(pg, 'd'):
                    await pg.wait_for_timeout(300)
                    btn = pg.get_by_role('button', name=re.compile('How Murshid worked this out'))
                    await click_glide(pg, btn, (900, 260), 800)
                    await pg.wait_for_timeout(1500)
                    await scroll_to(pg, 260, 2400); await pg.wait_for_timeout(2200)
                    await scroll_to(pg, 520, 2400); await pg.wait_for_timeout(2800)
            await pg.close()

        # E/F use a fresh teacher page: the post banner (with its expanded trace) is sticky and would cover the tabs.
        if want('e', 'f'):
            pg = await teacher_page(ctx)
            # E. best day for homework
            if want('e'):
                async with Shot(pg, 'e'):
                    await pg.wait_for_timeout(300)
                    pos = await click_glide(pg, pg.get_by_role('tab', name='Best day for homework'), (900, 420), 800)
                    await pg.wait_for_selector('[data-testid=best-day]'); await pg.wait_for_timeout(600)
                    rec = pg.get_by_text(re.compile('^Best day to set')).first
                    y = await pg.evaluate("(el) => el.getBoundingClientRect().top + scrollY - 150", await rec.element_handle())
                    await scroll_to(pg, max(0, y), 1200); await pg.wait_for_timeout(300)
                    pos = await glide_to(pg, rec, pos, 900)
                    await pg.wait_for_timeout(1700)
                    pos = await glide_to(pg, pg.get_by_text(re.compile('at risk . extra support')).first, pos, 900)
                    await pg.wait_for_timeout(1700)
                    cell = pg.locator('td.ring-2')
                    y = await pg.evaluate("(el) => el.getBoundingClientRect().top + scrollY - 330", await cell.element_handle())
                    await scroll_to(pg, max(0, y), 1500); await pg.wait_for_timeout(300)
                    pos = await glide_to(pg, cell, pos, 900)
                    await pg.wait_for_timeout(2800)
            # F. weekly reports
            if want('f'):
                await scroll_to(pg, 0, 400); await pg.wait_for_timeout(400)
                async with Shot(pg, 'f'):
                    await pg.wait_for_timeout(300)
                    pos = await click_glide(pg, pg.get_by_role('tab', name='Weekly reports'), (900, 400), 800)
                    await pg.wait_for_selector('text=Student reports'); await pg.wait_for_timeout(1400)
                    tabs = pg.get_by_role('tab', name='Weekly reports')
                    y = await pg.evaluate("(el) => el.getBoundingClientRect().top + scrollY - 70", await tabs.element_handle())
                    await scroll_to(pg, max(0, y), 1800); await pg.wait_for_timeout(1200)
                    await glide_to(pg, pg.get_by_text('Student reports').first, pos, 900)
                    await pg.wait_for_timeout(3000)

        # G. privacy and consent (student-side page, taller window)
        if want('g'):
            await web.bring_to_front()
            await goto(web, WEB + '/how-it-works', 1000)
            async with Shot(web, 'g'):
                await web.wait_for_timeout(300)
                y = await web.evaluate("(() => { const h = [...document.querySelectorAll('h2')].find(e => e.textContent.trim() === 'Guardrails'); return h.getBoundingClientRect().top + window.scrollY - 24; })()")
                await scroll_to(web, y, 2200); await web.wait_for_timeout(1200)
                pos = await glide_to(web, web.get_by_text('Consent', exact=True).first, (1000, 560), 900)
                await web.wait_for_timeout(1600)
                pos = await glide_to(web, web.get_by_text('School data separation').first, pos, 900)
                await web.wait_for_timeout(1500)
                pos = await glide_to(web, web.get_by_text('Human approval before anything is sent').first, pos, 900)
                await web.wait_for_timeout(1500)
                await glide_to(web, web.get_by_text('Audit log', exact=True).first, pos, 900)
                await web.wait_for_timeout(2400)

        # H. close
        if want('closing'): await card(ctx, 'closing', 11000)
        await b.close()

asyncio.run(main())
