"""The v4 demo timeline, shared by the compositor (comp.py) and the sound mix (mix.py).

Scenes run back to back with X-second transitions. Each recorded clip is re-timed to the narration with
anchors (source time -> scene time); every logged click, key and scroll is mapped through the same warp.
"""
import json, os

HERE = os.path.dirname(os.path.abspath(__file__))
CLIPS = os.path.join(HERE, '..', 'video', 'clips2')
FPS = 30
X = 0.7                                   # transition length
ORDER = 'abcdefgh'
VO = json.load(open(f'{HERE}/vo/timing.json'))['scenes']
LEAD = {'a': 0.8, 'h': 0.4}               # narration starts this long into the scene (default 0.5)
TAIL = {'a': 0.8, 'b': 1.1, 'h': 2.2}     # and the scene runs this long after it (default 0.9)
KIND = {'a': 'card', 'h': 'card'}         # the rest are app recordings
TRANS = {'b': 'rise', 'c': 'push', 'd': 'dissolve', 'e': 'push', 'f': 'push', 'g': 'push', 'h': 'reveal'}

def lead(s): return LEAD.get(s, 0.5)
def dur(s): return round(lead(s) + VO[s]['duration'] + TAIL.get(s, 0.9), 3)

START = {}
_t = 0.0
for _s in ORDER:
    START[_s] = round(_t, 3); _t += dur(_s) - X
LENGTH = round(START['h'] + dur('h'), 3)

def vo(s, i, word=None, end=False):
    """Scene time of narration line i (its start, its end, or a word in it, by character share)."""
    r = VO[s]['lines'][i]
    if end: return lead(s) + r['end']
    k = r['text'].index(word) / len(r['text']) if word else 0
    return lead(s) + r['start'] + (r['end'] - r['start']) * k

# ---------------------------------------------------------------- recorded events
def events(s):
    p = f'{CLIPS}/{s}.events.json'
    return json.load(open(p)) if os.path.exists(p) else {'events': [], 'view': [1440, 720], 'size': [2880, 1440], 'duration': 0}

def find(s, type_, name=None, n=0):
    hits = [e for e in events(s)['events'] if e['type'] == type_ and (name is None or e.get('name') == name)]
    return hits[n]['t'] if n < len(hits) else None

def keys(s): return [e for e in events(s)['events'] if e['type'] == 'key']

# anchors: (source time, scene time). After the last anchor the clip plays on at 1x, or holds if HOLD.
def anchors(s):
    if s == 'b':
        k = keys(s)
        return [(0, 0), (find(s, 'scroll'), vo('b', 1) + 0.05), (find(s, 'move'), 3.9), (find(s, 'click'), 4.75),
                (find(s, 'move', n=1), 5.1), (find(s, 'click', n=1), 5.7), (k[0]['t'], 5.8), (k[-1]['t'], 8.3),
                (find(s, 'sse', 'route'), 8.6), (find(s, 'mark', 'workings') - 1.0, 13.9), (find(s, 'mark', 'workings') - 0.97, 14.35)]
    if s == 'c':
        k = keys(s)
        return [(0, 0), (find(s, 'move'), 1.75), (find(s, 'click'), 2.7), (find(s, 'move', n=1), 2.95), (find(s, 'click', n=1), 3.35),
                (k[0]['t'], 3.45), (k[-1]['t'], 5.25), (find(s, 'move', n=2), 5.45), (find(s, 'click', n=2), 5.85),
                (find(s, 'move', n=3), 6.0), (find(s, 'click', n=3), 6.6), (find(s, 'mark', 'posted'), 6.75),
                (find(s, 'move', n=4), 7.1), (find(s, 'moveEnd', n=4), 7.9), (find(s, 'mark', 'risk'), 14.0)]
    if s in 'defg':
        return [(0, 0.1)]
    return [(0, 0)]

HOLD = {'b'}

def _pts(s):
    a = sorted({round(x, 4): y for x, y in anchors(s) if x is not None}.items())
    return a

def src_at(s, t):
    """Source clip time shown at scene time t."""
    a = _pts(s)
    if t <= a[0][1]: return a[0][0]
    for (s0, t0), (s1, t1) in zip(a, a[1:]):
        if t <= t1: return s0 + (s1 - s0) * (t - t0) / max(t1 - t0, 1e-6)
    s1, t1 = a[-1]
    return s1 if s in HOLD else s1 + (t - t1)

def out_at(s, src):
    """Scene time at which source time src is shown (inverse of src_at)."""
    a = _pts(s)
    if src <= a[0][0]: return a[0][1] - (a[0][0] - src)
    for (s0, t0), (s1, t1) in zip(a, a[1:]):
        if src <= s1: return t0 + (t1 - t0) * (src - s0) / max(s1 - s0, 1e-6)
    s1, t1 = a[-1]
    return None if s in HOLD else t1 + (src - s1)

def scene_events(s):
    """Recorded events re-timed to scene time (dropped when they fall after a hold)."""
    out = []
    for e in events(s)['events']:
        t = out_at(s, e['t'])
        if t is None or t > dur(s): continue
        out.append({**e, 'at': t, 'abs': START[s] + t})
    return out

# ---------------------------------------------------------------- camera
# (start, end, zoom, cx, cy) in the scene's CSS pixels; the camera eases to each state over [start, end].
CAM = {
    'b': [(0.2, 1.4, 1.32, 560, 230), (1.75, 2.9, 1.16, 880, 470), (3.6, 4.5, 1.0, 720, 360), (5.0, 5.75, 1.45, 830, 380),
          (8.5, 9.3, 1.38, 870, 257), (12.2, 13.3, 1.32, 800, 330)],
    'c': [(0.2, 1.4, 1.32, 560, 237), (2.75, 3.4, 1.6, 640, 230), (5.3, 5.9, 1.45, 640, 380), (6.8, 7.6, 1.3, 778, 235),
          (9.4, 10.4, 1.36, 786, 226), (13.3, 14.3, 1.36, 786, 246)],
    'd': [(0.0, 0.01, 1.25, 700, 250), (1.6, 2.4, 1.4, 788, 300), (6.4, 7.2, 1.5, 788, 262), (9.4, 10.2, 1.4, 788, 300), (11.6, 12.5, 1.3, 788, 320)],
    'e': [(2.75, 3.7, 1.35, 774, 240), (5.35, 6.2, 1.9, 1145, 205), (8.45, 9.3, 1.9, 1145, 245)],
    'f': [(1.6, 2.6, 1.6, 1030, 594), (5.0, 6.2, 1.3, 780, 480)],
    'g': [(2.8, 3.6, 1.55, 505, 360), (5.7, 6.5, 1.55, 723, 360), (9.0, 9.8, 1.55, 1159, 360), (11.8, 12.6, 1.55, 505, 640), (13.6, 14.7, 1.12, 720, 450)],
}
# where the cursor is shown (scene time ranges); b hides it once he starts typing
CURSOR = {'b': (0, 6.05), 'c': (0, 99), 'd': (0, 99), 'e': (0, 99), 'f': (0, 99), 'g': (0, 99)}

CAPTION = {
    'b': ('Student', 'Ahamed asks Murshid to plan his week around a mid-term and two sports'),
    'c': ('Teacher', "One assignment, and every student's week is replanned, with at-risk flags"),
    'd': ('Under the hood', 'Every plan shows its working: goal, steps, tools, actions and result'),
    'e': ('Best day for homework', 'Set Tuesday, due Thursday: 83% likely on time'),
    'f': ('Weekly reports', "Each student's report sends itself on Friday and rolls up to the teacher"),
    'g': ('Privacy', 'Consent per purpose, separate school data, human approval, an audit log'),
}

if __name__ == '__main__':
    for s in ORDER:
        print(s, 'start', START[s], 'dur', dur(s), 'vo', VO[s]['duration'], 'trans', TRANS.get(s, '-'))
    print('length', LENGTH)
    for s in 'bc':
        print(s, [(round(x, 2), round(y, 2)) for x, y in _pts(s)])
