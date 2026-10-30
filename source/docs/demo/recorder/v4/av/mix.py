"""Sound for the Murshid demo v4: narration chain, synthesised sound effects on every logged event, music ducked
under the voice, mastered to -16 LUFS. Writes mix.wav (48 kHz stereo) and sfx-cues.json (what was placed where).
"""
import json, math, subprocess
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve, resample_poly, lfilter
import timeline as TL

SR = 48000
HERE = TL.HERE
N = int((TL.LENGTH + 0.3) * SR)
rng = np.random.default_rng(5)

def db(x): return 10 ** (x / 20)
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x).astype(np.float32)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x).astype(np.float32)
def bp(x, a, b, o=2): return sosfilt(butter(o, [a, b], 'band', fs=SR, output='sos'), x).astype(np.float32)
def noise(n): return rng.normal(0, 1, n).astype(np.float32)
def tt(sec): return np.arange(int(sec * SR)) / SR
def peak(x, g_db): m = np.max(np.abs(x)) or 1; return (x / m * db(g_db)).astype(np.float32)

def peaking(x, f, gain_db, q):
    A = 10 ** (gain_db / 40); w = 2 * math.pi * f / SR; al = math.sin(w) / (2 * q)
    b = [1 + al * A, -2 * math.cos(w), 1 - al * A]; a = [1 + al / A, -2 * math.cos(w), 1 - al / A]
    return lfilter(np.array(b) / a[0], np.array(a) / a[0], x).astype(np.float32)

from scipy.ndimage import minimum_filter1d
def limiter(x, ceiling, look=0.006, rel=0.09):
    """Look-ahead peak limiter: gain never lets |x| exceed ceiling; smooth release."""
    a = np.abs(x) if x.ndim == 1 else np.max(np.abs(x), 1)
    g = np.minimum(1, ceiling / np.maximum(a, 1e-9))
    n = int(look * SR); g = minimum_filter1d(g, 2 * n + 1, origin=-n // 2 if n else 0)   # start reducing ahead of the peak
    r = 1 - g; k = math.exp(-1 / (rel * SR)); rs = lfilter([1 - k], [1, -k], r); r = np.maximum(r, rs)
    k2 = math.exp(-1 / (0.0008 * SR)); r = lfilter([1 - k2], [1, -k2], r); r = np.maximum(r, 1 - g) if False else r
    g = (1 - r).astype(np.float32)
    return x * (g if x.ndim == 1 else g[:, None])

# ------------------------------------------------------------------ bus
SL = np.zeros(N, np.float32); SRr = np.zeros(N, np.float32)
CUES = []
def put(sig, t, g_db=0.0, pan=0.0, name=''):
    if sig.ndim == 1: l, r = sig * math.cos((pan + 1) * math.pi / 4) * 1.414, sig * math.sin((pan + 1) * math.pi / 4) * 1.414
    else: l, r = sig[:, 0], sig[:, 1]
    i = int(t * SR)
    if i < 0 or i >= N: return
    n = min(len(l), N - i); g = db(g_db)
    SL[i:i + n] += l[:n] * g; SRr[i:i + n] += r[:n] * g
    CUES.append({'t': round(t, 3), 'sfx': name, 'db': g_db})

# ------------------------------------------------------------------ sound design
def click():
    t = tt(0.03)
    def tr(f, a):
        return a * (bp(noise(len(t)), 1800, 7500) * np.exp(-t / 0.0012) + 0.35 * np.sin(2 * np.pi * f * t) * np.exp(-t / 0.003) + 0.2 * np.sin(2 * np.pi * 1100 * t) * np.exp(-t / 0.005))
    out = np.zeros(int(0.12 * SR), np.float32); out[:len(t)] += tr(3200, 1.0); j = int(0.075 * SR); out[j:j + len(t)] += tr(3700, 0.5)
    return peak(out, 0)

def key(kind='k'):
    t = tt(0.06); r = rng.normal()
    fb = (1100 if kind == ' ' else 1300 if kind == 'enter' else 1650) * (1 + 0.1 * r)
    dk = 1.6 if kind in (' ', 'enter') else 1.0
    th = bp(noise(len(t)), 250, 2800) * np.exp(-t / (0.010 * dk)) + 0.3 * np.sin(2 * np.pi * fb * t) * np.exp(-t / 0.0045) + 0.35 * np.sin(2 * np.pi * (185 + 25 * r) * t) * np.exp(-t / (0.018 * dk))
    tick = hp(noise(len(t)), 4000) * np.exp(-t / 0.0015) * 0.35
    press = th + tick
    out = np.zeros(int(0.16 * SR), np.float32); out[:len(t)] += press
    if kind == ' ': j = int(0.009 * SR); out[j:j + len(t)] += press * 0.35
    j = int((0.055 + 0.03 * rng.random()) * SR); out[j:j + len(t)] += tick * 0.8 + th * 0.12
    return peak(out, 0) * (1.0 if kind == 'k' else 1.15)

def swoosh(dur=0.7, p0=0.6, p1=-0.6, lo=300, hi=3200, sub=0.12):
    n = int(dur * SR); u = np.arange(n) / n
    bands = [250, 500, 1000, 2000, 4000, 8000]; src = noise(n)
    filt = [bp(src, f / 1.41, min(f * 1.41, 20000)) for f in bands]
    shape = np.sin(np.pi * np.clip(u / 0.62, 0, 1) * 0.5) ** 2 * (u <= 0.62) + (np.cos(np.pi * 0.5 * np.clip((u - 0.62) / 0.38, 0, 1)) ** 2) * (u > 0.62)
    c = lo * (hi / lo) ** shape
    mono = np.zeros(n, np.float32)
    for f, x in zip(bands, filt): mono += x * np.exp(-((np.log2(f) - np.log2(c)) ** 2) / (2 * 0.55 ** 2))
    env = np.sin(np.pi * u ** 0.85) ** 2
    mono *= env
    mono += sub * np.sin(2 * np.pi * 72 * u * dur) * np.exp(-((u - 0.6) / 0.18) ** 2)
    pan = p0 + (p1 - p0) * u
    st = np.stack([mono * np.cos((pan + 1) * np.pi / 4), mono * np.sin((pan + 1) * np.pi / 4)], 1) * 1.414
    return st / np.max(np.abs(st))

def pop():
    t = tt(0.2); f = 330 + 620 * np.exp(-t / 0.05); ph = 2 * np.pi * np.cumsum(f) / SR
    s = (np.sin(ph) + 0.2 * np.sin(2 * ph)) * np.minimum(1, t / 0.002) * np.exp(-t / 0.06)
    return peak(lp(s.astype(np.float32), 3000), 0)

def bell(f, dur=1.6):
    t = tt(dur); s = np.zeros(len(t), np.float32)
    for ratio, a, d in [(1, 1, 1.3), (2.01, 0.45, 0.8), (2.99, 0.22, 0.45), (4.2, 0.1, 0.3), (5.43, 0.05, 0.2)]:
        s += a * np.sin(2 * np.pi * f * ratio * t) * np.exp(-t / d)
    return s * np.minimum(1, t / 0.002)
def chime(freqs, gap=0.09):
    out = np.zeros(int((1.8 + gap * len(freqs)) * SR), np.float32)
    for k, f in enumerate(freqs):
        b = bell(f); j = int(k * gap * SR); out[j:j + len(b)] += b * (0.85 ** k)
    return peak(out, 0)

def tick(f):
    t = tt(0.05); s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.012) + 0.3 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.006)) * np.minimum(1, t / 0.001)
    return peak(s.astype(np.float32), 0)

def riser(dur=1.6):
    n = int(dur * SR); u = np.arange(n) / n; src = noise(n)
    bands = [300, 600, 1200, 2400, 4800, 9600]; c = 300 * (5000 / 300) ** u; mono = np.zeros(n, np.float32)
    for f in bands: mono += bp(src, f / 1.41, min(f * 1.41, 20000)) * np.exp(-((np.log2(f) - np.log2(c)) ** 2) / (2 * 0.5 ** 2))
    f = 180 * (700 / 180) ** u; mono = mono * u ** 2.2 + 0.25 * np.sin(2 * np.pi * np.cumsum(f) / SR) * u ** 2
    mono[-int(0.03 * SR):] *= np.linspace(1, 0, int(0.03 * SR))
    return peak(mono.astype(np.float32), 0)

def impact():
    t = tt(2.0); f = 38 + 70 * np.exp(-t / 0.4); s = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.9) * np.minimum(1, t / 0.003)
    s = s + lp(noise(len(t)), 400) * np.exp(-t / 0.06) * 0.5
    return peak(s.astype(np.float32), 0)

def shimmer(n=14, spread=0.5):
    out = np.zeros(int(1.8 * SR), np.float32)
    for _ in range(n):
        f = rng.uniform(2400, 7200); d = rng.uniform(0.4, 1.0); j = int(rng.uniform(0, spread) * SR); t = tt(1.8 - j / SR - 0.01)
        out[j:j + len(t)] += rng.uniform(0.3, 1) * np.sin(2 * np.pi * f * t) * np.exp(-t / d) * np.minimum(1, t / 0.004)
    return peak(lp(out, 9000), 0)

def swish(dur):
    n = int(max(0.25, dur) * SR); u = np.arange(n) / n
    return peak(bp(noise(n), 1500, 6000) * np.sin(np.pi * u) ** 2 * 0.25, 0)

# ------------------------------------------------------------------ cue sheet
CT = json.load(open(f'{HERE}/../video/cards/card-times.json'))
A, Hh = TL.START['a'], TL.START['h']
put(impact(), A + 0.05, -20, 0, 'impact'); put(shimmer(), A + 0.3, -31, 0.2, 'shimmer')
for k in ('s1', 's2', 's3'): put(pop(), A + CT['a'][k] + 0.1, -30, -0.3, 'pop')
put(swoosh(1.5, -0.5, 0.5, 250, 2600, 0.1), A + CT['a']['spin'], -26, 0, 'swoosh-spin'); put(shimmer(10, 0.4), A + CT['a']['spin'] + 0.7, -32, 0.3, 'shimmer')

for s in 'bcdefgh':
    st = TL.START[s]; kind = TL.TRANS[s]
    if kind == 'rise': put(swoosh(1.0, 0, 0, 220, 3800, 0.18), st - 0.12, -22, 0, 'swoosh-rise')
    elif kind == 'push': put(swoosh(0.8, 0.7, -0.7), st - 0.08, -23, 0, 'swoosh-push')
    elif kind == 'dissolve': put(swoosh(0.7, 0.2, -0.2, 400, 2000, 0.0), st - 0.05, -32, 0, 'air')
    elif kind == 'reveal':
        put(riser(1.6), st - 1.25, -27, 0, 'riser'); put(impact(), st + 0.32, -19, 0, 'impact'); put(shimmer(), st + 0.4, -30, -0.2, 'shimmer')
put(swoosh(1.2, 0.5, -0.5, 250, 2600, 0.08), Hh + 0.25, -29, 0, 'swoosh-spin')
put(chime([1174.7, 1480.0, 1760.0], 0.11), Hh + CT['h']['url'] + 0.15, -27, 0.15, 'chime-url')

STEP = [1174.7, 1318.5, 1480.0, 1760.0, 1975.5, 2349.3]
for s in 'bcdefg':
    view = TL.events(s)['view']; step = 0
    for e in TL.scene_events(s):
        T = e['abs']; pan = 0
        if 'x' in e: pan = (e['x'] / view[0] - 0.5) * 0.8
        typ = e['type']
        if typ == 'click': put(click(), T, -24, pan, 'click')
        elif typ == 'key':
            ch = e.get('ch', 'k')
            if ch == 'Enter': put(key('enter'), T, -25, 0.1, 'key-enter'); put(swoosh(0.35, -0.2, 0.4, 600, 3500, 0.0), T + 0.05, -32, 0, 'send')
            else: put(key(' ' if ch == ' ' else 'k'), T, -29 + rng.normal(0, 1.2), 0.1 + rng.normal(0, 0.05), 'key')
        elif typ == 'sse' and e.get('name') in ('agent-tool', 'agent-done'):
            put(tick(STEP[min(step, len(STEP) - 1)]), T, -33, 0.2, 'tick'); step += 1
        elif typ == 'sse' and e.get('name') == 'done': put(chime([1174.7, 1760.0]), T, -29, 0.2, 'chime-done')
        elif typ == 'scroll': put(swish(e.get('dur', 0.8)), T, -38, 0, 'scroll')
        elif typ == 'mark' and e.get('name') == 'dialog': put(pop(), T, -28, 0, 'pop-dialog')
        elif typ == 'mark' and e.get('name') == 'posted': put(chime([880.0, 1318.5]), T + 0.05, -26, 0, 'chime-posted')
        elif typ == 'mark' and e.get('name') == 'percent': put(shimmer(9, 0.3), T - 0.1, -31, 0.4, 'shimmer')
        elif typ == 'mark' and e.get('name') in ('consent', 'separation', 'approval', 'audit'): put(tick(1760.0), T, -35, pan, 'tick')
    # camera zoom-ins get a breath of air
    z = 1.0
    for t0, t1, z1, *_ in TL.CAM.get(s, []):
        if z1 - z >= 0.25: put(swoosh(max(0.5, t1 - t0), 0, 0, 500, 2200, 0.0), TL.START[s] + t0, -37, 0, 'zoom-air')
        z = z1

# small room on the effects so they sit together
ir = noise(int(0.45 * SR)) * np.exp(-np.arange(int(0.45 * SR)) / SR / 0.09); ir = lp(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
SL = SL + fftconvolve(SL, ir)[:N] * 0.2; SRr = SRr + fftconvolve(SRr, ir[::-1].copy())[:N] * 0.2

# ------------------------------------------------------------------ narration
vo = np.zeros(N, np.float32)
for s in TL.ORDER:
    a, sr = sf.read(f'{HERE}/vo/{s}.wav', dtype='float32')
    a = resample_poly(a, SR, sr).astype(np.float32)
    i = int((TL.START[s] + TL.lead(s)) * SR); vo[i:i + len(a)] += a[:N - i]
vo = hp(vo, 75)
vo = peaking(vo, 180, 1.5, 0.9); vo = peaking(vo, 3000, 1.5, 1.0); vo = peaking(vo, 6500, -2.0, 2.0)
# gentle compression
env = np.sqrt(lfilter([1 - 0.995], [1, -0.995], vo ** 2) + 1e-12); lvl = 20 * np.log10(env)
gr = np.where(lvl > -24, (lvl + 24) * (1 - 1 / 2.5), 0); gr = lfilter([1 - 0.999], [1, -0.999], gr)
vo = vo * db(-gr)
# a touch of room so it is not inside your head
room = noise(int(0.3 * SR)) * np.exp(-np.arange(int(0.3 * SR)) / SR / 0.05); room = lp(room, 5000); room /= np.sqrt(np.sum(room ** 2))
voL = vo + fftconvolve(vo, room)[:N] * 0.09; voR = vo + fftconvolve(vo, room[::-1].copy())[:N] * 0.09
act = np.abs(vo) > 0.01
speech_rms = np.sqrt(np.mean(vo[act] ** 2)) if act.any() else 1
g = db(-17) / speech_rms; voL *= g; voR *= g
st = limiter(np.stack([voL, voR], 1), db(-17 + 11)); voL, voR = st[:, 0], st[:, 1]

# ------------------------------------------------------------------ music, ducked under the voice
m, _ = sf.read(f'{HERE}/music.wav', dtype='float32'); m = m[:N] if len(m) >= N else np.pad(m, ((0, N - len(m)), (0, 0)))
e = np.abs(vo * g); att, rel = math.exp(-1 / (0.08 * SR)), math.exp(-1 / (0.6 * SR))
# fast attack, slow release envelope (vectorised in two passes of a one-pole filter)
env1 = lfilter([1 - rel], [1, -rel], e); env1 = np.maximum(env1, lfilter([1 - att], [1, -att], e))
duck = np.clip(env1 / (db(-17) * 0.6), 0, 1)
duck = lfilter([1 - math.exp(-1 / (0.15 * SR))], [1, -math.exp(-1 / (0.15 * SR))], duck)
mg = db(-5.0) * (1 - 0.42 * duck)
mL, mR = m[:, 0] * mg, m[:, 1] * mg

L = voL + mL + SL; R = voR + mR + SRr
np.savez_compressed(f'{HERE}/stems.npz', vo=((voL + voR) / 2)[::4], mu=((mL + mR) / 2)[::4], fx=((SL + SRr) / 2)[::4])
master = np.stack([L, R], 1).astype(np.float32)
def lufs(x):
    sf.write(f'{HERE}/mix-pre.wav', x, SR, subtype='FLOAT')
    out = subprocess.run(['ffmpeg', '-hide_banner', '-i', f'{HERE}/mix-pre.wav', '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return float(out[out.rindex('I:'):].split()[1])
# master: gain to -16 LUFS, then the limiter holds peaks under -1.8 dBFS; one correction pass for what the limiter took
for _ in range(2):
    master = master * db(-16 - lufs(master))
    master = limiter(master, db(-1.8))
js = {'input_i': round(lufs(master), 2), 'input_tp': round(20 * np.log10(np.max(np.abs(master))), 2)}
sf.write(f'{HERE}/mix.wav', master, SR, subtype='PCM_24')
json.dump(CUES, open(f'{HERE}/sfx-cues.json', 'w'), indent=0)
from collections import Counter
print('cues', len(CUES), dict(Counter(c['sfx'] for c in CUES)))
print('master I', js['input_i'], 'LUFS, sample peak', js['input_tp'], 'dBFS')
