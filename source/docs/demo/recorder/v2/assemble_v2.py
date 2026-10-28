"""Cut each scene to its narration length (+ breathing room), crossfade its shots, burn the caption into the top band."""
import json, subprocess
D = '/workspace/work/demo2'; B = f'{D}/build'; C = f'{D}/clips'
FONT = f'{D}/cards/Inter-SemiBold.ttf'
X = 0.4  # crossfade
def run(args):
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit(1)
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
ENC = ['-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-r','30']
ORDER = 'abcdefghij'
vo = {k: dur(f'{D}/vo/{k}.mp3') for k in ORDER}
# (clip, trim-start s, speed or None = fit, fixed duration or None)
SCENES = {
 'a': dict(shots=[('title', 0, 1, None)]),
 'b': dict(shots=[('b1', .3, None, None), ('b2', .2, None, 5.0)], cap='Two ways to get Murshid: families, or a school licence for every student'),
 'c': dict(shots=[('c1', .3, None, None), ('c2', .2, None, 6.4)], cap='A GEMS school connects Microsoft 365; teachers sign in with Microsoft'),
 'd': dict(shots=[('d1', .3, None, None), ('d2', .2, 1, 3.6), ('d3', .2, 1, 3.3)], cap="A teacher posts an assignment, and it lands in every student's plan"),
 'e': dict(shots=[('e', .3, None, None)], cap="Class progress: each student's work across all subjects, with at-risk flags"),
 'f': dict(shots=[('f', .2, None, None)], cap='Who needs what: support, more time or extension, each with a reason'),
 'g': dict(shots=[('g', .2, None, None)], cap="Best day to set homework, with the class's on-time likelihood"),
 'h': dict(shots=[('h', .2, None, None)], cap='Weekly reports send themselves every Friday and roll up to the teacher'),
 'i': dict(shots=[('i1', 2.2, None, None), ('i2', 5.2, None, 3.8)], cap='For students: a week planned around tests and training, plus opportunities'),
 'j': dict(shots=[('closing', 0, 1, None)]),
}
total = {k: round(vo[k] + .95, 2) for k in ORDER}
total['j'] = round(vo['j'] + 1.6, 2)
def shot(name, ss, speed, d, out):
    raw = dur(f'{C}/{name}.mp4') - ss
    if speed is None: speed = raw / d
    run(['ffmpeg','-y','-v','error','-ss',str(ss),'-i',f'{C}/{name}.mp4','-vf',
         f'setpts=(PTS-STARTPTS)/{speed:.4f},fps=30,tpad=stop_mode=clone:stop_duration=8,trim=duration={d:.3f},setpts=PTS-STARTPTS', *ENC, '-an', out])
    return speed
info = {}
for k in ORDER:
    sc = SCENES[k]; shots = sc['shots']; T = total[k]
    fixed = sum(s[3] for s in shots if s[3]); n_free = sum(1 for s in shots if not s[3])
    free = (T + X * (len(shots) - 1) - fixed) / max(n_free, 1)
    parts = []
    for i, (name, ss, sp, d) in enumerate(shots):
        d = d or free; out = f'{B}/{k}_{i}.mp4'
        s = shot(name, ss, sp, d, out); parts.append((out, d)); info.setdefault(k, []).append((name, round(d, 2), round(s, 2)))
    if len(parts) == 1: src = parts[0][0]
    else:
        inputs = sum([['-i', p] for p, _ in parts], []); fc = []; last = '[0:v]'; off = 0
        for i in range(1, len(parts)):
            off += parts[i-1][1] - X; lab = f'[x{i}]'
            fc.append(f'{last}[{i}:v]xfade=transition=fade:duration={X}:offset={off:.3f}{lab}'); last = lab
        src = f'{B}/{k}_chain.mp4'
        run(['ffmpeg','-y','-v','error',*inputs,'-filter_complex',';'.join(fc),'-map',last, *ENC, src])
    out = f'{B}/scene_{k}.mp4'
    if sc.get('cap'):
        open(f'{B}/cap_{k}.txt','w').write(sc['cap'])
        a = f"if(lt(t,0.6),0,if(lt(t,1.0),(t-0.6)/0.4,if(lt(t,{T-0.9:.2f}),1,if(lt(t,{T-0.5:.2f}),({T-0.5:.2f}-t)/0.4,0))))"
        vf = (f"drawtext=fontfile={FONT}:textfile={B}/cap_{k}.txt:fontsize=34:fontcolor=white:alpha='{a}':"
              f"box=1:boxcolor=0x15171c@0.80:boxborderw=18:x=(w-text_w)/2:y=28")
        run(['ffmpeg','-y','-v','error','-i',src,'-vf',vf,*ENC,'-t',f'{T:.3f}',out])
    else:
        run(['ffmpeg','-y','-v','error','-i',src,*ENC,'-t',f'{T:.3f}',out])
    print(k, T, info[k], round(dur(out), 2), flush=True)
json.dump({'total': total, 'vo': vo, 'info': info}, open(f'{B}/timing.json','w'), indent=1)
