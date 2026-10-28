"""Murshid demo v3 assembly.
Each scene: its clip(s) fitted to the narration length (+ breathing room), on a 1920x1080 canvas where the
recorded app fills the top 1920x960 and the caption sits in a 120 px band below it (captions never cover the UI).
Then scenes are joined with crossfades, narration laid on each scene, and a quiet pad mixed underneath.
Run: python3 assemble_v3.py [scenes|final|all]   (scenes can be limited with SCENES=abc)
Inputs: /workspace/work/demo3/clips/*.mp4 (scenes_v3.py), /workspace/work/demo3/vo/<k>.mp3 (narration.json via TTS)
Output: /workspace/murshid/docs/demo/murshid-demo-v3.mp4
"""
import json, os, shutil, subprocess, sys
D = '/workspace/work/demo3'; B = f'{D}/build'; C = f'{D}/clips'
HERE = os.path.dirname(os.path.abspath(__file__))
FONT = f'{HERE}/cards/Inter-SemiBold.ttf'
OUT = '/workspace/murshid/docs/demo/murshid-demo-v3.mp4'
X = 0.4            # crossfade between shots and scenes
BAND = 120         # caption band height under the 1920x960 app area
BAND_BG = '0x15171c'
ENC = ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30']
ORDER = 'abcdefgh'

# (clip, trim-start s, speed or None = fit to the time left, fixed duration or None)
SCENES = {
 'a': dict(shots=[('title', 0, 1, None)], extra=0.9,
           cap='The problem: students fall behind before anyone notices'),
 'b': dict(shots=[('b1', .3, None, 4.2), ('b2', .2, None, None)], extra=2.6,
           cap="Student: Murshid plans a demo student's week around his mid-term and sport"),
 'c': dict(shots=[('c', .3, None, None)], extra=1.0,
           cap="A teacher posts work once: every student's week is replanned, with at-risk flags"),
 'd': dict(shots=[('d', .2, None, None)], extra=1.2,
           cap='"How Murshid worked this out": goal, steps, tools, actions and result'),
 'e': dict(shots=[('e', .2, None, None)], extra=1.4,
           cap='Best day for homework: set Tuesday, due Thursday, 83% likely on time'),
 'f': dict(shots=[('f', .2, None, None)], extra=2.2,
           cap='Weekly reports send themselves every Friday and roll up to the teacher'),
 'g': dict(shots=[('g', .2, None, None)], extra=1.2,
           cap='Privacy: consent per purpose, separate school data, human approval, audit log'),
 'h': dict(shots=[('closing', 0, 1, None)], extra=1.6,
           cap='Try it: murshid-web.vercel.app/judges  \u00b7  Microsoft sign-in is simulated'),
}

def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: print(' '.join(args)[:400]); print(r.stderr[-3000:]); raise SystemExit(1)
def dur(p): return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', p]).strip())

vo = {k: dur(f'{D}/vo/{k}.mp3') for k in ORDER}
total = {k: round(vo[k] + SCENES[k]['extra'], 2) for k in ORDER}

def shot(name, ss, speed, d, out):
    raw = dur(f'{C}/{name}.mp4') - ss
    if speed is None: speed = raw / d
    run(['ffmpeg', '-y', '-v', 'error', '-ss', str(ss), '-i', f'{C}/{name}.mp4', '-vf',
         f'scale=1920:960,setpts=(PTS-STARTPTS)/{speed:.4f},fps=30,tpad=stop_mode=clone:stop_duration=10,trim=duration={d:.3f},setpts=PTS-STARTPTS',
         *ENC, '-an', out])
    return speed

def build_scenes(keys):
    os.makedirs(B, exist_ok=True)
    info = json.load(open(f'{B}/timing.json'))['info'] if os.path.exists(f'{B}/timing.json') else {}
    for k in keys:
        sc = SCENES[k]; shots = sc['shots']; T = total[k]
        fixed = sum(s[3] for s in shots if s[3]); n_free = sum(1 for s in shots if not s[3])
        free = (T + X * (len(shots) - 1) - fixed) / max(n_free, 1)
        parts = []; info[k] = []
        for i, (name, ss, sp, d) in enumerate(shots):
            d = d or free; out = f'{B}/{k}_{i}.mp4'
            s = shot(name, ss, sp, d, out); parts.append((out, d)); info[k].append((name, round(d, 2), round(s, 2)))
        if len(parts) == 1: src = parts[0][0]
        else:
            inputs = sum([['-i', p] for p, _ in parts], []); fc = []; last = '[0:v]'; off = 0
            for i in range(1, len(parts)):
                off += parts[i - 1][1] - X; lab = f'[x{i}]'
                fc.append(f'{last}[{i}:v]xfade=transition=fade:duration={X}:offset={off:.3f}{lab}'); last = lab
            src = f'{B}/{k}_chain.mp4'
            run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(fc), '-map', last, *ENC, src])
        open(f'{B}/cap_{k}.txt', 'w').write(sc['cap'])
        a = f"if(lt(t,0.4),0,if(lt(t,0.8),(t-0.4)/0.4,if(lt(t,{T-0.7:.2f}),1,if(lt(t,{T-0.3:.2f}),({T-0.3:.2f}-t)/0.4,0))))"
        vf = (f"pad=1920:{960+BAND}:0:0:color={BAND_BG},"
              f"drawbox=x=0:y=960:w=1920:h=2:color=0x2c3040:t=fill,"
              f"drawtext=fontfile={FONT}:textfile={B}/cap_{k}.txt:fontsize=36:expansion=none:fontcolor=white:alpha='{a}':"
              f"x=(w-text_w)/2:y=960+({BAND}-text_h)/2")
        out = f'{B}/scene_{k}.mp4'
        run(['ffmpeg', '-y', '-v', 'error', '-i', src, '-vf', vf, *ENC, '-t', f'{T:.3f}', out])
        print(k, 'T', T, 'vo', round(vo[k], 2), info[k], 'out', round(dur(out), 2), flush=True)
    json.dump({'total': total, 'vo': vo, 'info': info}, open(f'{B}/timing.json', 'w'), indent=1)

def final():
    N = len(ORDER); offs = {}; o = 0
    for k in ORDER: offs[k] = o; o += total[k] - X
    L = offs[ORDER[-1]] + total[ORDER[-1]]
    c1 = '(sin(2*PI*130.81*t)+sin(2*PI*164.81*t)+sin(2*PI*196*t)+0.6*sin(2*PI*246.94*t))'
    c2 = '(sin(2*PI*110*t)+sin(2*PI*130.81*t)+sin(2*PI*164.81*t)+0.6*sin(2*PI*196*t))'
    w = '(0.5+0.5*cos(2*PI*t/16))'
    expr = f"0.05*({w}*{c1}+(1-{w})*{c2})*(0.8+0.2*sin(2*PI*t/5))"
    run(['ffmpeg', '-y', '-v', 'error', '-f', 'lavfi', '-i', f"aevalsrc='{expr}':s=44100:d={L+1:.2f}",
         '-af', f'lowpass=f=1200,aecho=0.8:0.7:120|240:0.25|0.15,afade=t=in:d=2.5,afade=t=out:st={L-3:.2f}:d=3,volume=0.5,pan=stereo|c0=c0|c1=c0',
         '-ar', '44100', f'{B}/pad.wav'])
    inputs = []
    for k in ORDER: inputs += ['-i', f'{B}/scene_{k}.mp4']
    for k in ORDER: inputs += ['-i', f'{D}/vo/{k}.mp3']
    inputs += ['-i', f'{B}/pad.wav']
    fc = []; last = '[0:v]'
    for i, k in enumerate(ORDER[1:], 1):
        lab = f'[v{i}]'; fc.append(f'{last}[{i}:v]xfade=transition=fade:duration={X}:offset={offs[k]:.3f}{lab}'); last = lab
    fc.append(f'{last}fade=t=out:st={L-0.8:.2f}:d=0.8[vout]')
    labels = []
    for i, k in enumerate(ORDER):
        d = int((offs[k] + (0.4 if k == 'a' else 0.45)) * 1000)
        fc.append(f'[{N+i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={d}|{d}[a{i}]'); labels.append(f'[a{i}]')
    fc.append(f"{''.join(labels)}amix=inputs={N}:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[voice]")
    fc.append(f'[voice][{2*N}:a]amix=inputs=2:normalize=0:duration=first,atrim=0:{L:.3f}[aout]')
    tmp = f'{B}/murshid-demo-v3.mp4'
    run(['ffmpeg', '-y', '-v', 'error', *inputs, '-filter_complex', ';'.join(fc), '-map', '[vout]', '-map', '[aout]',
         '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-pix_fmt', 'yuv420p', '-r', '30',
         '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-t', f'{L:.3f}', tmp])
    json.dump({'offsets': offs, 'length': L, 'total': total, 'vo': vo}, open(f'{B}/offsets.json', 'w'), indent=1)
    shutil.copy(tmp, OUT)
    print('offsets', {k: round(v, 2) for k, v in offs.items()}, 'length', round(L, 2), 'out', round(dur(OUT), 2))

if __name__ == '__main__':
    mode = sys.argv[1] if len(sys.argv) > 1 else 'all'
    if mode in ('scenes', 'all'): build_scenes(os.environ.get('SCENES', ORDER))
    if mode in ('final', 'all'): final()
