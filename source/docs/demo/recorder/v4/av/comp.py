"""Compositor for the Murshid demo v4.

The app recordings sit in a rounded window on the navy brand background; a camera eases in on the action,
a smooth cursor is drawn from the logged mouse paths (with click ripples), captions sit under the window,
and scenes change with rise / push / dissolve / reveal transitions. Title and closing cards are full frame.

usage: comp.py preview t1,t2,...      -> prev/comp-<t>.jpg
       comp.py render out.mp4 [t0 t1] -> video only (sound is mixed by mix.py)
"""
import math, os, subprocess, sys
import cv2, numpy as np
from PIL import Image, ImageDraw, ImageFont
import timeline as TL

HERE = TL.HERE
W, H = 1920, 1080
SW, SH = 2880, 1440                       # recorded frame size
WX, WY, WW, WH, WR = 77, 34, 1766, 883, 24  # window rect and corner radius
NAVY = (0x63, 0x2f, 0x0f)                 # BGR
ROYAL = (0xc9, 0x63, 0x25)
FONT = f'{HERE}/onest.ttf'

def ease_io(p): p = min(1, max(0, p)); return 4 * p ** 3 if p < 0.5 else 1 - (-2 * p + 2) ** 3 / 2
def ease_out(p): p = min(1, max(0, p)); return 1 - (1 - p) ** 4
def ease_quad(p): p = min(1, max(0, p)); return 2 * p * p if p < 0.5 else 1 - (-2 * p + 2) ** 2 / 2
def smooth(a, b, t): return ease_io((t - a) / (b - a)) if b > a else float(t >= b)

# ------------------------------------------------------------------ static layers
def background():
    bg = np.empty((H, W, 3), np.uint8); bg[:] = NAVY
    over = bg.astype(np.float32)
    for k in range(1, 7):
        x = int(round(k * W / 7)); over[:, x:x + 1] = over[:, x:x + 1] * 0.93 + 255 * 0.07
    return over.astype(np.uint8)
BG = background()

def rounded_mask(w, h, r, ss=4):
    im = Image.new('L', (w * ss, h * ss), 0); ImageDraw.Draw(im).rounded_rectangle([0, 0, w * ss - 1, h * ss - 1], r * ss, fill=255)
    return np.asarray(im.resize((w, h), Image.LANCZOS), np.float32) / 255
MASK = rounded_mask(WW, WH, WR)
_inner = rounded_mask(WW - 2, WH - 2, WR - 1)
RING = MASK.copy(); RING[1:-1, 1:-1] -= _inner; RING = np.clip(RING, 0, 1)

def shadow_map():
    a = np.zeros((H, W), np.float32)
    y0 = WY + 22; a[y0:y0 + WH, WX:WX + WW] = MASK
    a = cv2.GaussianBlur(a, (0, 0), 34) * 0.42
    return a
SHADOW = shadow_map()

def font(size, weight):
    f = ImageFont.truetype(FONT, size); f.set_variation_by_axes([weight]); return f

def caption_layer(s):
    """Eyebrow + caption under the window, chapter dots on the right. RGBA, full width, 150 px tall."""
    eyebrow, text = TL.CAPTION[s]
    idx = 'bcdefg'.index(s)
    im = Image.new('RGBA', (W, 150), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    ef = font(15, 500); cf = font(31, 400)
    label = f'{idx + 1:02d} · {eyebrow}'.upper()
    x = WX; y = 24
    d.ellipse([x, y + 6, x + 7, y + 13], fill=(0x57, 0x90, 0xe6, 255)); x += 18
    for ch in label:  # tracked uppercase
        d.text((x, y), ch, font=ef, fill=(255, 255, 255, 178)); x += ef.getlength(ch) + 3.2
    d.text((WX, 52), text, font=cf, fill=(255, 255, 255, 236))
    # chapter dots: the active one is a pill
    dx = W - WX; cy = 72
    for j in reversed(range(6)):
        if j == idx:
            d.rounded_rectangle([dx - 26, cy - 4, dx, cy + 4], 4, fill=(255, 255, 255, 235)); dx -= 26 + 10
        else:
            d.ellipse([dx - 8, cy - 4, dx, cy + 4], fill=(255, 255, 255, 80)); dx -= 8 + 10
    return np.asarray(im, np.float32) / 255
CAPS = {s: caption_layer(s) for s in TL.CAPTION}

def cursor_sprite(px):
    """The arrow cursor, px tall, RGBA float; tip at (0, 0) of the returned image (plus pad)."""
    ss = 8; size = int(px * 1.3) + 8
    im = Image.new('RGBA', (size * ss, size * ss), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    k = px / 22 * ss; pad = 3 * ss
    pts = [(4, 2), (19, 12.5), (12.4, 13.8), (16.3, 21.2), (13.3, 22.7), (9.4, 15.2), (4, 20)]
    poly = [((x - 4) * k * 22 / 24 + pad, (y - 2) * k * 22 / 24 + pad) for x, y in pts]
    sh = Image.new('RGBA', im.size, (0, 0, 0, 0)); ImageDraw.Draw(sh).polygon([(x + 1.5 * k, y + 2.5 * k) for x, y in poly], fill=(0, 0, 0, 70))
    from PIL import ImageFilter
    sh = sh.filter(ImageFilter.GaussianBlur(2.2 * k))
    im = Image.alpha_composite(sh, im); d = ImageDraw.Draw(im)
    d.polygon(poly, fill=(17, 17, 17, 255)); d.line(poly + [poly[0]], fill=(255, 255, 255, 255), width=max(2, int(1.7 * k)), joint='curve')
    d.polygon(poly, fill=(17, 17, 17, 255))
    im = im.resize((size, size), Image.LANCZOS)
    a = np.asarray(im, np.float32) / 255
    return a, 3  # pad in px
_CUR = {}
def cursor_at_size(px):
    key = int(round(px))
    if key not in _CUR: _CUR[key] = cursor_sprite(key)
    return _CUR[key]

# ------------------------------------------------------------------ sources
class Reader:
    def __init__(self, path): self.path = path; self.cap = None; self.i = -1; self.f = None; self.n = None
    def get(self, i):
        if self.cap is None or i < self.i:
            self.cap = cv2.VideoCapture(self.path); self.i = -1
            self.n = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
        i = max(0, min(i, self.n - 1))
        while self.i < i:
            ok, f = self.cap.read()
            if not ok: self.i = i; break
            self.f = f; self.i += 1
        return self.f
READ = {s: Reader(f'{TL.CLIPS}/{"title" if s == "a" else "closing" if s == "h" else s}.mp4') for s in TL.ORDER}

class Scene:
    def __init__(self, s):
        self.s = s; ev = TL.events(s); self.view = ev['view']; self.k = SW / self.view[0]
        self.evs = TL.scene_events(s) if TL.KIND.get(s) != 'card' else []
        self.moves = self._moves(); self.clicks = [e['at'] for e in self.evs if e['type'] == 'click']
        self.clickpos = [(e['x'], e['y']) for e in self.evs if e['type'] == 'click']
        mv = [e for e in TL.events(s)['events'] if e['type'] == 'move']
        self.home = (mv[0]['x0'], mv[0]['y0']) if mv else (self.view[0] / 2, self.view[1] / 2)
    def _moves(self):
        out = []; evs = self.evs
        for i, e in enumerate(evs):
            if e['type'] != 'move': continue
            end = next((f['at'] for f in evs[i + 1:] if f['type'] == 'moveEnd'), None)
            if end is None: end = TL.out_at(self.s, e['t'] + e['dur']) or e['at'] + e['dur']
            t0 = e['at']
            if end - t0 < 0.42: t0 = end - 0.42
            if out and t0 < out[-1][1]: t0 = out[-1][1]
            out.append((t0, end, e['x0'], e['y0'], e['x1'], e['y1']))
        return out
    def cursor(self, t):
        x, y = self.home
        for t0, t1, x0, y0, x1, y1 in self.moves:
            if t < t0: break
            if t >= t1: x, y = x1, y1; continue
            e = ease_quad((t - t0) / (t1 - t0)); x, y = x0 + (x1 - x0) * e, y0 + (y1 - y0) * e; break
        return x, y
    def camera(self, t):
        z, cx, cy = 1.0, self.view[0] / 2, self.view[1] / 2
        for t0, t1, z1, x1, y1 in TL.CAM.get(self.s, []):
            if t < t0: break
            e = 1.0 if t >= t1 else ease_io((t - t0) / (t1 - t0))
            z = math.exp(math.log(z) + (math.log(z1) - math.log(z)) * e); cx += (x1 - cx) * e; cy += (y1 - cy) * e
        # a slow breath of zoom keeps holds alive
        z *= 1 + 0.012 * math.sin(t * 0.45)
        cx *= self.k; cy *= self.k
        cw, ch = SW / z, SH / z
        cx = min(max(cx, cw / 2), SW - cw / 2); cy = min(max(cy, ch / 2), SH - ch / 2)
        return z, cx, cy

    def content(self, t):
        """The window contents at scene time t: camera applied, cursor and ripples drawn."""
        src = TL.src_at(self.s, t)
        f = READ[self.s].get(int(round(src * TL.FPS)))
        z, cx, cy = self.camera(t)
        k = WW * z / SW                              # source px -> window px
        ox, oy = cx - SW / z / 2, cy - SH / z / 2    # crop origin in source px
        if k < 1:
            rw, rh = int(round(SW * k)), int(round(SH * k)); small = cv2.resize(f, (rw, rh), interpolation=cv2.INTER_AREA)
            kx, ky = rw / SW, rh / SH
            M = np.float32([[1, 0, -ox * kx], [0, 1, -oy * ky]])
            img = cv2.warpAffine(small, M, (WW, WH), flags=cv2.INTER_LINEAR, borderMode=cv2.BORDER_REPLICATE)
        else:
            M = np.float32([[k, 0, -ox * k], [0, k, -oy * k]])
            img = cv2.warpAffine(f, M, (WW, WH), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)
        img = img.astype(np.float32)
        to_win = lambda x, y: ((x * self.k - ox) * k, (y * self.k - oy) * k)
        # click ripples
        for tc, (x, y) in zip(self.clicks, self.clickpos):
            if tc <= t < tc + 0.55:
                e = ease_out((t - tc) / 0.55); px, py = to_win(x, y); r = (7 + 30 * e) * self.k * k
                a = 0.5 * (1 - e)
                ring = np.zeros(img.shape[:2], np.uint8); cv2.circle(ring, (int(px * 4), int(py * 4)), int(r * 4), 255, 3, cv2.LINE_AA, 2)
                fill = np.zeros(img.shape[:2], np.uint8); cv2.circle(fill, (int(px * 4), int(py * 4)), int(r * 0.92 * 4), 255, -1, cv2.LINE_AA, 2)
                al = (ring.astype(np.float32) / 255 * a + fill.astype(np.float32) / 255 * a * 0.22)[..., None]
                img = img * (1 - al) + np.array(ROYAL, np.float32) * al
        # cursor
        lo, hi = TL.CURSOR.get(self.s, (0, 0))
        vis = smooth(lo - 0.01, lo, t) * (1 - smooth(hi, hi + 0.25, t)) if hi < 90 else smooth(lo - 0.01, lo, t)
        if vis > 0.01:
            x, y = self.cursor(t); px, py = to_win(x, y)
            press = any(tc <= t < tc + 0.16 for tc in self.clicks)
            size = 22 * self.k * k * (0.86 if press else 1)
            spr, pad = cursor_at_size(size)
            sx, sy = int(round(px - pad)), int(round(py - pad)); h_, w_ = spr.shape[:2]
            x0, y0, x1, y1 = max(sx, 0), max(sy, 0), min(sx + w_, WW), min(sy + h_, WH)
            if x1 > x0 and y1 > y0:
                sp = spr[y0 - sy:y1 - sy, x0 - sx:x1 - sx]; al = sp[..., 3:4] * vis
                img[y0:y1, x0:x1] = img[y0:y1, x0:x1] * (1 - al) + sp[..., [2, 1, 0]] * 255 * al
        return img

SCENES = {s: Scene(s) for s in TL.ORDER}

def card(s, t):
    return READ[s].get(int(round(t * TL.FPS))).astype(np.float32)

# ------------------------------------------------------------------ compositing
def place_window(frame, content, alpha=1.0, scale=1.0, dx=0.0, dy=0.0):
    """Shadow + rounded window (with its hairline) onto frame, transformed about the window centre."""
    if alpha <= 0.001: return frame
    if abs(scale - 1) < 1e-4 and abs(dx) < 0.01 and abs(dy) < 0.01:
        sh = SHADOW[..., None] * alpha
        frame = frame * (1 - sh)
        reg = frame[WY:WY + WH, WX:WX + WW]
        c = content * (1 - RING[..., None] * 0.12) + 255 * RING[..., None] * 0.12
        a = MASK[..., None] * alpha
        frame[WY:WY + WH, WX:WX + WW] = reg * (1 - a) + c * a
        return frame
    cx, cy = WX + WW / 2 + dx, WY + WH / 2 + dy
    M = np.float32([[scale, 0, cx - scale * WW / 2], [0, scale, cy - scale * WH / 2]])
    c = content * (1 - RING[..., None] * 0.12) + 255 * RING[..., None] * 0.12
    cw = cv2.warpAffine(c, M, (W, H), flags=cv2.INTER_LINEAR)
    mw = cv2.warpAffine(MASK, M, (W, H), flags=cv2.INTER_LINEAR)[..., None] * alpha
    Ms = np.float32([[scale, 0, (1 - scale) * (WX + WW / 2) + dx], [0, scale, (1 - scale) * (WY + WH / 2) + dy]])
    sh = cv2.warpAffine(SHADOW, Ms, (W, H), flags=cv2.INTER_LINEAR)[..., None] * alpha
    frame = frame * (1 - sh)
    return frame * (1 - mw) + cw * mw

def add_caption(frame, s, T):
    st, en = TL.START[s], TL.START[s] + TL.dur(s)
    a = smooth(st + TL.X, st + TL.X + 0.55, T) * (1 - smooth(en - TL.X - 0.45, en - TL.X + 0.05, T))
    if a <= 0.001: return frame
    lay = CAPS[s]; y = 914 + int(round(10 * (1 - smooth(st + TL.X, st + TL.X + 0.55, T))))
    reg = frame[y:y + 150]; al = lay[..., 3:4] * a
    frame[y:y + 150] = reg * (1 - al) + lay[..., [2, 1, 0]] * 255 * al
    return frame

def frame_at(T):
    act = [s for s in TL.ORDER if TL.START[s] <= T < TL.START[s] + TL.dur(s)] or ['h']
    fr = BG.astype(np.float32)
    if len(act) == 1:
        s = act[0]; t = T - TL.START[s]
        if TL.KIND.get(s) == 'card':
            fr = card(s, t)
            if s == 'a': fr = fr * smooth(0, 0.6, t) + fr * 0  # fade up from black
            if s == 'h': fr = fr * (1 - smooth(TL.dur('h') - 1.0, TL.dur('h') - 0.05, t))
        else:
            fr = place_window(fr, SCENES[s].content(t)); fr = add_caption(fr, s, T)
        return fr
    A, B = act[0], act[1]; tA, tB = T - TL.START[A], T - TL.START[B]
    p = tB / TL.X; e = ease_io(p); kind = TL.TRANS[B]
    if kind == 'rise':
        fr = card(A, tA) * (1 - e) + fr * e
        fr = place_window(fr, SCENES[B].content(tB), 1.0, 0.95 + 0.05 * ease_out(p), 0, (1 - ease_out(p)) * (H - WY + 60))
    elif kind == 'push':
        fr = place_window(fr, SCENES[A].content(tA), 1 - e, 1 - 0.07 * e, -e * 1180, 0)
        fr = place_window(fr, SCENES[B].content(tB), min(1, e * 1.5), 0.93 + 0.07 * e, (1 - e) * 1180, 0)
        fr = add_caption(fr, A, T); fr = add_caption(fr, B, T)
    elif kind == 'dissolve':
        c = SCENES[A].content(tA) * (1 - e) + SCENES[B].content(tB) * e
        fr = place_window(fr, c); fr = add_caption(fr, A, T); fr = add_caption(fr, B, T)
    elif kind == 'reveal':
        fr = fr * (1 - e) + card(B, tB) * e
        fr = place_window(fr, SCENES[A].content(tA), 1 - e, 1 - 0.1 * e, 0, -24 * e)
        fr = add_caption(fr, A, T)
    return fr

def to8(fr): return np.clip(fr + 0.5, 0, 255).astype(np.uint8)

if __name__ == '__main__':
    mode = sys.argv[1]
    if mode == 'preview':
        os.makedirs(f'{HERE}/prev', exist_ok=True)
        for t in map(float, sys.argv[2].split(',')):
            cv2.imwrite(f'{HERE}/prev/comp-{t:06.2f}.jpg', to8(frame_at(t)), [cv2.IMWRITE_JPEG_QUALITY, 90])
    else:
        out = sys.argv[2]; t0 = float(sys.argv[3]) if len(sys.argv) > 3 else 0; t1 = float(sys.argv[4]) if len(sys.argv) > 4 else TL.LENGTH
        n0, n1 = int(round(t0 * TL.FPS)), int(round(t1 * TL.FPS))
        p = subprocess.Popen(['ffmpeg', '-y', '-v', 'error', '-f', 'rawvideo', '-pix_fmt', 'bgr24', '-s', f'{W}x{H}', '-r', str(TL.FPS), '-i', '-',
                              '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-tune', 'film', out], stdin=subprocess.PIPE)
        import time; t_start = time.time()
        for n in range(n0, n1):
            p.stdin.write(to8(frame_at(n / TL.FPS)).tobytes())
            if n % 150 == 0: print(f'{n / TL.FPS:6.1f}s  {(time.time() - t_start):5.0f}s elapsed', flush=True)
        p.stdin.close(); p.wait(); print('done', out)
