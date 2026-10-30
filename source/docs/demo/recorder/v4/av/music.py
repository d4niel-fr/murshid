"""Calm music bed for the demo, composed to the timeline (timeline.py).

Real instrument samples (FluidR3 GM via gleitz/midi-js-soundfonts, MIT) for piano, electric piano and celesta;
the warm pad, sub bass, felt kick and shaker are synthesised. 90 BPM, D major; the bar grid is placed so a bar
line lands exactly on the first app scene, the privacy scene and the closing card.
Writes music.wav (48 kHz stereo float).
"""
import os, subprocess, urllib.request
import numpy as np, soundfile as sf
from scipy.signal import butter, sosfilt, fftconvolve
import timeline as TL

SR = 48000
HERE = TL.HERE
CACHE = f'{HERE}/sf'
os.makedirs(CACHE, exist_ok=True)
BAR = 4 * 60 / 90
T0 = TL.START['b'] - 7 * BAR                       # bar 7 starts on scene b
LEN = int((TL.LENGTH + 0.5) * SR)
rng = np.random.default_rng(11)
NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

def bar_t(n, beat=0.0): return T0 + n * BAR + beat * BAR / 4

_S = {}
def sample(ins, midi):
    key = (ins, midi)
    if key in _S: return _S[key]
    name = f'{NAMES[midi % 12]}{midi // 12 - 1}'
    p = f'{CACHE}/{ins}-{name}.mp3'
    if not os.path.exists(p):
        urllib.request.urlretrieve(f'https://raw.githubusercontent.com/gleitz/midi-js-soundfonts/gh-pages/FluidR3_GM/{ins}-mp3/{name}.mp3', p)
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', p, '-f', 'f32le', '-ac', '1', '-ar', str(SR), '-'], capture_output=True, check=True).stdout
    a = np.frombuffer(raw, np.float32).copy()
    # trim the encoder's leading silence and fade the tail
    i = np.argmax(np.abs(a) > 1e-3); a = a[i:]
    f = int(0.25 * SR); a[-f:] *= np.linspace(1, 0, f) ** 2
    _S[key] = a
    return a

L = np.zeros(LEN, np.float32); R = np.zeros(LEN, np.float32)
def add(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR)
    if i >= LEN or i + len(sig) <= 0: return
    s = sig[:max(0, LEN - i)] * gain
    if i < 0: s = s[-i:]; i = 0
    gl, gr = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    L[i:i + len(s)] += s * gl * 1.414; R[i:i + len(s)] += s * gr * 1.414

def lp(x, f, order=2): return sosfilt(butter(order, f, 'low', fs=SR, output='sos'), x).astype(np.float32)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x).astype(np.float32)
def bp(x, f1, f2, order=2): return sosfilt(butter(order, [f1, f2], 'band', fs=SR, output='sos'), x).astype(np.float32)
def hz(m): return 440 * 2 ** ((m - 69) / 12)

# ------------------------------------------------------------------ harmony
CH = {  # voicing (mid register), bass note
    'Bm9': ([50, 54, 57, 61], 35), 'Gmaj9': ([50, 54, 57, 59], 31), 'Em9': ([50, 54, 55, 59], 40), 'F#sus': ([52, 59, 61, 64], 42),
    'Asus': ([52, 57, 59, 62], 33), 'Dmaj9': ([50, 57, 61, 64], 38), 'A6sus': ([52, 57, 59, 61], 33),
}
INTRO = ['Bm9', 'Gmaj9', 'Em9', 'F#sus', 'Bm9', 'Gmaj9', 'Asus']            # bars 0-6: the problem
LOOP = ['Dmaj9', 'Bm9', 'Gmaj9', 'A6sus']                                   # bars 7-36: the product
OUTRO = ['Gmaj9', 'A6sus', 'Dmaj9']                                         # bars 35-37+: resolve
B_END = 32; G_END = 37                                                      # bar 32: privacy, bar 37: close
plan = {}
for n in range(0, 7): plan[n] = INTRO[n]
for n in range(7, 35): plan[n] = LOOP[(n - 7) % 4]
plan[35], plan[36], plan[37] = OUTRO

# ------------------------------------------------------------------ pad (synth)
def pad_chord(notes, secs, bright=900):
    n = int(secs * SR); t = np.arange(n) / SR; out = np.zeros(n, np.float32)
    for m in notes:
        for det in (-0.07, 0.0, 0.07):           # three slightly detuned saws per note
            f = hz(m) * 2 ** (det / 12); ph = rng.random()
            out += (2 * ((t * f + ph) % 1) - 1).astype(np.float32) * 0.18
    out = lp(lp(out, bright), bright * 1.2)
    a = int(0.9 * SR); r = int(1.4 * SR)
    env = np.ones(n, np.float32); env[:a] = np.linspace(0, 1, a) ** 1.5; env[-r:] *= np.linspace(1, 0, r) ** 1.5
    return out * env

for n in range(0, 38):
    c = plan[n]; notes, bass = CH[c]
    secs = BAR + 1.4 if n < 37 else 9.0
    level = 0.05 if n < 7 else 0.042 if n < B_END else 0.05
    p = pad_chord([m + 12 for m in notes[1:]] + [notes[0]], secs, 700 if n < 7 else 1000)
    add(p, bar_t(n) - 0.2, level * (0.55 + 0.45 * min(1, n / 3)), -0.25)
    p2 = pad_chord([m + 12 for m in notes[1:]] + [notes[0]], secs, 700 if n < 7 else 1000)  # new phases: stereo width
    add(p2, bar_t(n) - 0.18, level * 0.9 * (0.55 + 0.45 * min(1, n / 3)), 0.25)

# ------------------------------------------------------------------ electric piano chords (samples)
for n in range(0, 38):
    notes, _ = CH[plan[n]]
    if n < 7 and n % 2 == 1: continue              # sparse in the intro
    vel = 0.11 if n < 7 else 0.085
    for j, m in enumerate(notes):
        add(lp(sample('electric_piano_1', m + 12), 5500), bar_t(n) + j * 0.012, vel * (0.9 if j else 1), -0.15 + 0.1 * j)
    if n == 37:  # the final chord rings, with the root an octave down
        add(lp(sample('electric_piano_1', notes[0]), 2500), bar_t(n), 0.1, 0)

# ------------------------------------------------------------------ piano arpeggio (samples)
PATTERN = [0, 2, 3, 4, 3, 2, 1, 2]
for n in range(7, 37):
    if n >= B_END and n % 2: continue             # thinner in the privacy scene
    notes, _ = CH[plan[n]]
    up = sorted(set([m + 12 for m in notes] + [notes[1] + 24]))
    for k, idx in enumerate(PATTERN):
        if n < 9 and k % 2: continue                # the pulse grows in over the first bars
        m = up[min(idx, len(up) - 1)]
        acc = 1.0 if k in (0, 4) else 0.72
        hum = rng.normal(0, 0.006)
        add(lp(sample('acoustic_grand_piano', m), 7500), bar_t(n, k * 0.5) + hum, 0.075 * acc, 0.3 - 0.6 * (k / 7))

# intro piano: a few low notes, like someone thinking
for n, m in [(0, 59), (1, 62), (2, 66), (3, 61), (4, 59), (5, 62), (6, 64)]:
    add(lp(sample('acoustic_grand_piano', m), 3000), bar_t(n, 2), 0.06, 0.2)

# celesta motif in the second half of the product section
for n in range(19, 31, 2):
    for k, m in enumerate([78, 81, 76]):
        add(lp(sample('celesta', m), 6000), bar_t(n, 4 + k * 1.5), 0.028, 0.35)

# ------------------------------------------------------------------ sub bass (synth)
def bass_note(m, secs):
    n = int(secs * SR); t = np.arange(n) / SR; f = hz(m)
    s = np.sin(2 * np.pi * f * t) + 0.25 * np.sin(4 * np.pi * f * t) + 0.08 * np.sin(6 * np.pi * f * t)
    env = np.minimum(1, t / 0.05) * np.exp(-t / 1.6)
    return lp((np.tanh(s * 1.2) * env).astype(np.float32), 400)
for n in range(9, 38):
    _, b = CH[plan[n]]
    m = b + 12 if b < 36 else b
    if n >= B_END and n < G_END:
        add(bass_note(m, BAR), bar_t(n), 0.04, 0); continue
    add(bass_note(m, BAR * 0.5 + 0.2), bar_t(n), 0.055, 0); add(bass_note(m, BAR * 0.5), bar_t(n, 2), 0.042, 0)
    if n == 37: add(bass_note(m, 7), bar_t(n), 0.07, 0)

# ------------------------------------------------------------------ felt kick and shaker (synth)
def kick():
    n = int(0.35 * SR); t = np.arange(n) / SR
    f = 52 + 60 * np.exp(-t / 0.03); ph = 2 * np.pi * np.cumsum(f) / SR
    return lp((np.sin(ph) * np.exp(-t / 0.12)).astype(np.float32), 180)
def shaker(acc):
    n = int(0.07 * SR); t = np.arange(n) / SR
    s = bp(rng.normal(0, 1, n).astype(np.float32), 5500, 11000) * (np.minimum(1, t / 0.008) * np.exp(-t / 0.025))
    return s * acc
K = kick()
for n in range(11, B_END):
    for beat in (0, 2):
        add(K, bar_t(n, beat), 0.1 if beat == 0 else 0.07, 0)
    for k in range(8):
        add(shaker(1.0 if k % 2 else 0.55), bar_t(n, k * 0.5) + rng.normal(0, 0.004), 0.022, 0.4)

# ------------------------------------------------------------------ space: a soft hall
def hall(secs=2.6, pre=0.025):
    n = int(secs * SR); t = np.arange(n) / SR
    irs = []
    for ch in range(2):
        noise = rng.normal(0, 1, n).astype(np.float32) * np.exp(-6.9 * t / secs)
        noise = lp(noise, 5000) * 0.6 + lp(noise, 1800) * 0.4
        ir = np.concatenate([np.zeros(int(pre * SR), np.float32), noise]); irs.append(ir / np.sqrt(np.sum(ir ** 2)))
    return irs
irL, irR = hall()
wetL = fftconvolve(L, irL)[:LEN]; wetR = fftconvolve(R, irR)[:LEN]
outL = hp(L * 0.8 + wetL * 0.55, 35); outR = hp(R * 0.8 + wetR * 0.55, 35)

# shape: fade in at the start, swell at the lift into the product, long fade at the end
t = np.arange(LEN) / SR
shape = np.minimum(1, t / 2.5) ** 2
shape *= 1 + 0.25 * np.clip((TL.START['b'] - 1.5 - t) / 12, 0, 1)  # the sparse intro is lifted a little            # intro sits lower
end = TL.LENGTH
shape *= np.clip((end - t) / 4.5, 0, 1) ** 1.5
mix = np.stack([outL * shape, outR * shape], 1)
mix /= np.max(np.abs(mix)) / 0.5
sf.write(f'{HERE}/music.wav', mix.astype(np.float32), SR, subtype='FLOAT')
print('music', round(LEN / SR, 2), 's; bar', round(BAR, 3), 'grid origin', round(T0, 3), 'samples cached', len(os.listdir(CACHE)))
