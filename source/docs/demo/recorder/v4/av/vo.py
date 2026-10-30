"""Narration for the Murshid demo: Kokoro (open-source TTS), one sentence at a time with hand-set pauses.

Writes vo/<scene>.wav (24 kHz mono, raw) and vo/timing.json: per scene the start/end of every line.
usage: vo.py [voice] [speed]
"""
import json, os, re, sys
import numpy as np, soundfile as sf
from kokoro_onnx import Kokoro

HERE = os.path.dirname(os.path.abspath(__file__))
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'af_heart'
SPEED = float(sys.argv[2]) if len(sys.argv) > 2 else 0.92
OUT = f'{HERE}/vo'
os.makedirs(OUT, exist_ok=True)

# Words espeak gets wrong, written as phonemes.
SAY = {
    'Murshid': 'mˈʊɹʃɪd',
    'Ahamed': 'ˈɑːhəmɛd',
    'Ms.': 'mˈɪz',
    'murshid-web': 'mˈʊɹʃɪd wˈɛb',
}

# (text, pause after in seconds). A scene is a list of lines.
SCRIPT = {
    'a': [
        ('Every week, a Grade 11 student juggles six subjects, homework from every teacher, tests, and sport.', 0.45),
        ("At a school of four and a half thousand students, there's one counsellor for every nine hundred or so.", 0.5),
        ('So the students who fall behind are spotted far too late.', 0.6),
        ("That's where Murshid comes in.", 0.0),
    ],
    'b': [
        ('Meet Ahamed.', 0.3),
        ('He has a mid-term coming up, with football and swimming on top.', 0.4),
        ('He asks Murshid to plan his week.', 0.45),
        ('It reads his timetable, his tests and his training, and writes the plan straight into his calendar.', 0.0),
    ],
    'c': [
        ('Now his English teacher, Ms. Thomas, posts one assignment.', 0.4),
        ("It lands in every student's plan, and Murshid replans each week around it.", 0.35),
        ('A work session on their lightest day, a reminder the evening before, and a flag for anyone at risk, with the reason why.', 0.0),
    ],
    'd': [
        ('And it never asks you to just trust it.', 0.4),
        ("Murshid is an agent. It understands the goal, plans the steps, uses tools on the student's own timetable, and takes action.", 0.4),
        ('Then it shows its working. Every step.', 0.0),
    ],
    'e': [
        ('It even finds the best day to set homework.', 0.4),
        ("Set it Tuesday, due Thursday, and it's eighty-three percent likely to come in on time.", 0.4),
        ('The three students at risk get extra support.', 0.0),
    ],
    'f': [
        ("Every Friday, each student's weekly report sends itself, and rolls up here.", 0.35),
        ('So teachers can see who needs help, before it is too late.', 0.0),
    ],
    'g': [
        ('Privacy is built in, not bolted on.', 0.45),
        ('Consent is recorded for every purpose.', 0.35),
        ('School data never mixes with family accounts.', 0.35),
        ('Nothing is sent without a person saying yes, and every change is logged.', 0.0),
    ],
    'h': [
        ('Murshid.', 0.7),
        ('Every student on top of their work.', 0.3),
        ('Every teacher with the full picture.', 0.6),
        ('Try it today, at murshid-web dot vercel dot app, slash judges.', 0.0),
    ],
}

k = Kokoro(f'{HERE}/models/kokoro-v1.0.onnx', f'{HERE}/models/voices-v1.0.bin')


def phonemes(text):
    """Phonemise, swapping in the fixed pronunciations."""
    keys = sorted(SAY, key=len, reverse=True)
    parts = re.split('(' + '|'.join(re.escape(x) for x in keys) + ')', text)
    out = []
    for p in parts:
        if not p:
            continue
        if p in SAY:
            out.append(SAY[p])
        else:
            ph = k.tokenizer.phonemize(p, 'en-us')
            # keep the spacing and punctuation of the original chunk edges
            if p[:1] == ' ' and not ph.startswith(' '):
                ph = ' ' + ph
            if p[-1:] == ' ' and not ph.endswith(' '):
                ph = ph + ' '
            out.append(ph)
    return re.sub(' +', ' ', ''.join(out)).strip()


def trim(a, sr, thr=0.004):
    """Cut leading/trailing silence, keeping 40 ms of air on each side."""
    idx = np.where(np.abs(a) > thr)[0]
    if not len(idx):
        return a
    s = max(0, idx[0] - int(0.04 * sr)); e = min(len(a), idx[-1] + int(0.06 * sr))
    a = a[s:e].copy()
    f = int(0.012 * sr); a[:f] *= np.linspace(0, 1, f); a[-f * 3:] *= np.linspace(1, 0, f * 3)
    return a


timing = {}
for scene, lines in SCRIPT.items():
    chunks, t, rows = [], 0.0, []
    for text, pause in lines:
        ph = phonemes(text)
        a, sr = k.create(ph, voice=VOICE, speed=SPEED, lang='en-us', is_phonemes=True)
        a = trim(a.astype(np.float32), sr)
        d = len(a) / sr
        rows.append({'text': text, 'start': round(t, 3), 'end': round(t + d, 3), 'phonemes': ph})
        chunks += [a, np.zeros(int(pause * sr), np.float32)]
        t += d + pause
    audio = np.concatenate(chunks)
    sf.write(f'{OUT}/{scene}.wav', audio, sr)
    timing[scene] = {'duration': round(len(audio) / sr, 3), 'lines': rows}
    print(scene, round(len(audio) / sr, 2), 's')
json.dump({'voice': VOICE, 'speed': SPEED, 'scenes': timing}, open(f'{OUT}/timing.json', 'w'), indent=1)
print('total', round(sum(v['duration'] for v in timing.values()), 1))
