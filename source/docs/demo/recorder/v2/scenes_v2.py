"""Murshid demo v2 (schools-first): records every clip in one browser context so API state and the teacher's
Microsoft session carry from scene to scene. Run after restart-api.sh with the web app on :3000 and the school
portal on :3001 (production builds). Output: /workspace/work/demo2/clips/<shot>.mp4
"""
import asyncio, re, sys
from playwright.async_api import async_playwright
from rec2 import Shot, browser

BASE = 'http://localhost:3000'
ADMIN = 'http://localhost:3001'
CARDS = 'file:///workspace/work/demo2/cards'

SCROLL_JS = """([y, ms]) => new Promise(res => { const s = window.scrollY, t0 = performance.now();
  const f = (t) => { const k = Math.min(1, (t - t0) / ms); const e = k < .5 ? 2*k*k : 1 - Math.pow(-2*k + 2, 2)/2;
    window.scrollTo(0, s + (y - s) * e); k < 1 ? requestAnimationFrame(f) : res(); }; requestAnimationFrame(f); })"""
async def scroll_to(pg, y, ms): await pg.evaluate(SCROLL_JS, [y, ms])

async def goto(pg, url, settle=1500):
    await pg.goto(url, wait_until='networkidle'); await pg.wait_for_timeout(settle)

async def glide(pg, x0, y0, x1, y1, ms, steps=36):
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

async def chat(pg, text, delay=30):
    box = pg.locator('textarea').first
    await box.click()
    await pg.evaluate("(() => { const c = document.getElementById('__demo_cursor'); if (c) c.style.display = 'none'; })()")
    await pg.keyboard.type(text, delay=delay)
    await pg.wait_for_timeout(300)
    await pg.keyboard.press('Enter')

import datetime, zoneinfo
def _school_days_ahead(n):
    d = datetime.datetime.now(zoneinfo.ZoneInfo('Asia/Dubai')).date()
    while n:
        d += datetime.timedelta(days=1)
        if d.weekday() < 5: n -= 1
    return d.isoformat()
DUE = _school_days_ahead(2)

async def main():
    async with async_playwright() as p:
        b, ctx = await browser(p)
        # A. title
        await card(ctx, 'title', 9800)

        # B. two ways to get Murshid
        pg = await ctx.new_page()
        await goto(pg, BASE + '/pricing')
        async with Shot(pg, 'b1'):
            await pg.wait_for_timeout(500)
            pos = await glide_to(pg, pg.get_by_text('Murshid for Schools').first, (900, 650), 1300)
            await pg.wait_for_timeout(900)
            pos = await glide_to(pg, pg.get_by_text('AED 29'), pos, 1100)
            await pg.wait_for_timeout(500)
            pos = await glide_to(pg, pg.get_by_text('AED 79'), pos, 800)
            await pg.wait_for_timeout(500)
            await glide_to(pg, pg.get_by_text('AED 150'), pos, 1000)
            await pg.wait_for_timeout(1200)
        await goto(pg, BASE + '/welcome', 1000)
        async with Shot(pg, 'b2'):
            await pg.wait_for_timeout(400)
            pos = await glide_to(pg, pg.get_by_text('I\u2019m a parent'), (640, 650), 900)
            await pg.wait_for_timeout(500)
            pos = await glide_to(pg, pg.get_by_text('I\u2019m a student'), pos, 700)
            await pg.wait_for_timeout(400)
            await glide_to(pg, pg.get_by_text('My school provides Murshid'), pos, 1000)
            await pg.wait_for_timeout(1500)
        await pg.close()

        # C. GEMS school connects Microsoft 365; teacher signs in with Microsoft
        pg = await ctx.new_page()
        await goto(pg, ADMIN + '/school', 1500)
        async with Shot(pg, 'c1'):
            await pg.wait_for_timeout(700)
            pos = await glide_to(pg, pg.get_by_text("Our Own High School Al Warqa'a").first, (700, 600), 900)
            await pg.wait_for_timeout(500)
            await click_glide(pg, pg.get_by_role('button', name='Connect Microsoft 365'), pos, 900)
            await pg.wait_for_selector('text=Connected', timeout=10000)
            await pg.wait_for_timeout(2400)
        await goto(pg, ADMIN + '/login', 1000)
        async with Shot(pg, 'c2'):
            await pg.wait_for_timeout(500)
            pos = await click_glide(pg, pg.get_by_role('button', name='Sign in with Microsoft'), (900, 600), 800)
            await pg.wait_for_selector('text=Pick an account'); await pg.wait_for_timeout(900)
            await click_glide(pg, pg.get_by_text('Mr. Vikram Desai'), pos, 700)
            await pg.wait_for_url('**/teacher'); await pg.wait_for_selector('text=Class progress'); await pg.wait_for_timeout(1800)

        # D. teacher posts an assignment -> it lands in the student's app
        async with Shot(pg, 'd1'):
            await pg.wait_for_timeout(300)
            await click_glide(pg, pg.get_by_role('button', name='Post assignment'), (800, 400), 700)
            await pg.wait_for_selector('role=dialog'); await pg.wait_for_timeout(300)
            await pg.get_by_label('Title').click(); await pg.keyboard.type('Quadratic equations: problem set', delay=22)
            await pg.get_by_label('Instructions').click(); await pg.keyboard.type('Questions 1-12, show your working.', delay=14)
            # due in two school days: a short window, so the class's best-day recommendation shown later is unchanged
            await pg.get_by_label('Due').fill(DUE)
            await pg.wait_for_timeout(300)
            await click_glide(pg, pg.get_by_role('button', name='Post to class'), (640, 420), 600)
            await pg.wait_for_selector('role=status'); await pg.wait_for_timeout(2200)
        web = await ctx.new_page()
        await goto(web, BASE + '/', 1800)
        async with Shot(web, 'd2'):
            row = web.get_by_text('Quadratic equations').first
            await row.scroll_into_view_if_needed()
            x, y = await center(row)
            await glide(web, 1000, 650, x + 40, y, 900, 24)
            await web.wait_for_timeout(2600)
        await goto(web, BASE + '/school', 1500)
        async with Shot(web, 'd3'):
            x, y = await center(web.get_by_text('Quadratic equations: problem set').first)
            await glide(web, 1000, 600, x, y, 800, 24)
            await web.wait_for_timeout(2300)

        # E-H. teacher portal tabs
        await pg.bring_to_front()
        await goto(pg, ADMIN + '/teacher?tab=progress', 1500)
        async with Shot(pg, 'e'):
            await pg.wait_for_timeout(600)
            pos = await glide_to(pg, pg.locator('td span', has_text='At risk').first, (900, 500), 900)
            await pg.wait_for_timeout(600)
            await scroll_to(pg, 190, 2000)
            await pg.wait_for_timeout(500)
            await glide_to(pg, pg.get_by_text('Ahamed Mehta').first, pos, 900)
            await pg.wait_for_timeout(2600)
        await scroll_to(pg, 0, 300)
        async with Shot(pg, 'f'):
            await pg.wait_for_timeout(300)
            pos = await click_glide(pg, pg.get_by_role('tab', name='Who needs what'), (700, 300), 700)
            await pg.wait_for_selector('text=Needs support'); await pg.wait_for_timeout(800)
            pos = await glide_to(pg, pg.locator('h3', has_text='Needs support'), pos, 700)
            await pg.wait_for_timeout(700)
            pos = await glide_to(pg, pg.locator('h3', has_text='Same task, more time'), pos, 800)
            await pg.wait_for_timeout(900)
            await glide_to(pg, pg.locator('h3', has_text='Ready for extension'), pos, 800)
            await pg.wait_for_timeout(1500)
        async with Shot(pg, 'g'):
            await pg.wait_for_timeout(200)
            pos = await click_glide(pg, pg.get_by_role('tab', name='Best day for homework'), (900, 500), 700)
            await pg.wait_for_selector('[data-testid=best-day]'); await pg.wait_for_timeout(600)
            pos = await glide_to(pg, pg.get_by_text(re.compile('^Best day to set')), pos, 900)
            await pg.wait_for_timeout(1800)
            await scroll_to(pg, 240, 1400)
            await pg.wait_for_timeout(300)
            best = pg.locator('td.ring-2')
            pos = await glide_to(pg, best, pos, 900)
            await pg.wait_for_timeout(1300)
            await glide(pg, pos[0], pos[1], 1000, 560, 900, 24)
            await pg.wait_for_timeout(1500)
        await scroll_to(pg, 0, 300)
        async with Shot(pg, 'h'):
            await pg.wait_for_timeout(200)
            pos = await click_glide(pg, pg.get_by_role('tab', name='Weekly reports'), (900, 400), 700)
            await pg.wait_for_selector('text=Student reports'); await pg.wait_for_timeout(900)
            pos = await click_glide(pg, pg.get_by_role('button', name='Last week'), pos, 600)
            await pg.wait_for_timeout(700)
            await glide_to(pg, pg.get_by_text('Reports in'), pos, 700)
            await pg.wait_for_timeout(1600)

        # I. student side: plan + opportunities
        await web.bring_to_front()
        await goto(web, BASE + '/chat', 1200)
        async with Shot(web, 'i1'):
            await web.wait_for_timeout(400)
            await chat(web, 'Plan my week around my mid-term and both sports', 26)
            await web.wait_for_selector('text=Your week plan', timeout=20000)
            await web.wait_for_timeout(400)
            await chat_scroll(web, 'Your week plan', 12, 1300)
            await web.wait_for_timeout(1600)
        async with Shot(web, 'i2'):
            await web.wait_for_timeout(200)
            await chat(web, 'Find opportunities for Tideline and save the best one', 18)
            await web.wait_for_selector('text=Young Founders Pitch Night', timeout=20000)
            await web.wait_for_timeout(900)
            await chat_scroll(web, None, 0, 1300)
            await web.wait_for_timeout(1800)

        # J. closing
        await card(ctx, 'closing', 8200)
        await b.close()

asyncio.run(main())
