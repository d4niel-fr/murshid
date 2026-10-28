import asyncio, base64, json, os, subprocess, time, urllib.parse
from playwright.async_api import async_playwright

PREFS = urllib.parse.quote(json.dumps({"band":"g11-12","locale":"en","theme":"light","dataMode":"auto","sidebar":"expanded","persona":"demo-ideal"}))
W, H, DPR = 1280, 720, 1.5
OUT = '/workspace/work/demo/clips'

# Paces the /chat SSE stream for the recording so each sub-agent step is readable (rules mode answers in ~20 ms).
PACE_JS = r"""
(() => {
  const PACE = { 'route': 400, 'agent-start': 500, 'agent-tool': 750, 'agent-done': 600, 'meta': 150, 'done': 300 };
  const orig = window.fetch.bind(window);
  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input.url;
    const res = await orig(input, init);
    const ct = res.headers.get('content-type') || '';
    if (!/\/chat$/.test(url) || !ct.includes('text/event-stream') || !res.body) return res;
    const reader = res.body.getReader(); const enc = new TextEncoder(); const dec = new TextDecoder();
    let buf = '';
    const body = new ReadableStream({
      async start(ctrl) {
        for (;;) {
          const { value, done } = await reader.read();
          if (value) buf += dec.decode(value, { stream: true });
          let i;
          while ((i = buf.indexOf('\n\n')) >= 0) {
            const frame = buf.slice(0, i + 2); buf = buf.slice(i + 2);
            const ev = (/^event: *(.+)$/m.exec(frame) || [])[1] || '';
            await new Promise(r => setTimeout(r, PACE[ev.trim()] ?? 60));
            ctrl.enqueue(enc.encode(frame));
          }
          if (done) { if (buf) ctrl.enqueue(enc.encode(buf)); ctrl.close(); return; }
        }
      }
    });
    return new Response(body, { status: res.status, headers: res.headers });
  };
})();
"""


CURSOR_JS = r"""
(() => {
  const add = () => {
    if (document.getElementById('__demo_cursor')) return;
    const c = document.createElement('div'); c.id = '__demo_cursor';
    c.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24"><path d="M4 2l15 10.5-6.6 1.3 3.9 7.4-3 1.5-3.9-7.5L4 20z" fill="#111" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-40px', top: '-40px', zIndex: 2147483647, pointerEvents: 'none', transition: 'transform .12s', filter: 'drop-shadow(0 2px 3px rgba(0,0,0,.25))' });
    document.documentElement.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX - 3 + 'px'; c.style.top = e.clientY - 2 + 'px'; }, true);
    addEventListener('mousedown', () => { c.style.transform = 'scale(.8)'; }, true);
    addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
  };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', add); else add();
})();
"""

class Shot:
    """CDP screencast recorder: frames + timestamps -> VFR concat list -> CFR 30fps mp4."""
    def __init__(self, page, name):
        self.page, self.name, self.frames = page, name, []
    async def __aenter__(self):
        self.cdp = await self.page.context.new_cdp_session(self.page)
        self.cdp.on('Page.screencastFrame', self._on)
        await self.cdp.send('Page.startScreencast', {'format': 'jpeg', 'quality': 92, 'maxWidth': 1920, 'maxHeight': 1080, 'everyNthFrame': 1})
        self.t0 = time.time()
        await self.page.wait_for_timeout(150)
        return self
    def _on(self, ev):
        self.frames.append((time.time(), ev['data']))
        asyncio.ensure_future(self.cdp.send('Page.screencastFrameAck', {'sessionId': ev['sessionId']}))
    async def __aexit__(self, *a):
        t_end = time.time()
        await self.cdp.send('Page.stopScreencast')
        d = f'{OUT}/{self.name}'; os.makedirs(d, exist_ok=True)
        for f in os.listdir(d): os.remove(f'{d}/{f}')
        lines = []
        fr = self.frames
        for i, (t, data) in enumerate(fr):
            p = f'{d}/f{i:05d}.jpg'; open(p, 'wb').write(base64.b64decode(data))
            nxt = fr[i + 1][0] if i + 1 < len(fr) else t_end
            lines.append(f"file '{p}'\nduration {max(nxt - t, 0.001):.4f}")
        lines.append(f"file '{d}/f{len(fr)-1:05d}.jpg'")
        open(f'{d}/list.txt', 'w').write('\n'.join(lines) + '\n')
        subprocess.run(['ffmpeg', '-y', '-v', 'error', '-f', 'concat', '-safe', '0', '-i', f'{d}/list.txt',
                        '-vf', 'scale=1920:1080:flags=lanczos,fps=30,format=yuv420p', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18',
                        f'{OUT}/{self.name}.mp4'], check=True)
        print(self.name, f'{t_end - self.t0:.1f}s', len(fr), 'frames', flush=True)

async def browser(p):
    b = await p.chromium.launch(executable_path='/usr/bin/chromium', args=['--no-sandbox', '--hide-scrollbars', '--font-render-hinting=none'])
    ctx = await b.new_context(viewport={'width': W, 'height': H}, device_scale_factor=DPR)
    await ctx.add_cookies([{'name': 'murshid_prefs', 'value': PREFS, 'url': 'http://localhost:3001'}])
    await ctx.add_cookies([{'name': 'murshid_prefs', 'value': PREFS, 'url': 'http://localhost:3000'}])
    await ctx.add_init_script(PACE_JS)
    await ctx.add_init_script(CURSOR_JS)
    return b, ctx
