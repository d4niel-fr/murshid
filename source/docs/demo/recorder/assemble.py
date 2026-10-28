import json, subprocess, os
D = '/workspace/work/demo'; B = f'{D}/build'; C = f'{D}/clips'
FONT = f'{D}/cards/Inter-SemiBold.ttf'
X = 0.4  # crossfade
def run(args): 
    r = subprocess.run(args, capture_output=True, text=True)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit(1)
def dur(p): return float(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','csv=p=0',p]).strip())
ENC = ['-c:v','libx264','-preset','veryfast','-crf','18','-pix_fmt','yuv420p','-r','30']
vo = {k: dur(f'{D}/vo/{k}.mp3') for k in 'abcdefg'}
SCENES = {
 'a': dict(shots=[('title', 0, 1, None)]),
 'b': dict(shots=[('b1', .2, 1, 5.2), ('b2', .2, 1, 4.8), ('b3', .2, 1, 4.8), ('b4', .2, 1, None)],
           cap="Ahamed's year in football, swimming and grades, straight from the API"),
 'c': dict(shots=[('c', .3, None, None)], cap='One ask, two agents in parallel: the Planner and the Sports coach build his week'),
 'd': dict(shots=[('d', .8, None, None)], cap='The Opportunities scout saves a pitch night for Tideline'),
 'e': dict(shots=[('e1', .6, None, None), ('e2', 0, 1, 3.4)], cap='The Career & CV agent writes a LinkedIn-ready CV, exported as a PDF'),
 'f': dict(shots=[('f1', .4, None, None), ('f2', .2, 1, 4.4)], cap="An admin adds a task, and it is in Ahamed's app straight away"),
 'g': dict(shots=[('closing', 0, 1, None)]),
}
order = 'abcdefg'
total = {k: round(vo[k] + .95, 2) for k in order}
total['g'] = round(vo['g'] + 1.25, 2)
def shot(name, ss, speed, d, out):
    raw = dur(f'{C}/{name}.mp4') - ss
    if speed is None: speed = raw / d
    run(['ffmpeg','-y','-v','error','-ss',str(ss),'-i',f'{C}/{name}.mp4','-vf',
         f'setpts=(PTS-STARTPTS)/{speed:.4f},fps=30,tpad=stop_mode=clone:stop_duration=6,trim=duration={d:.3f},setpts=PTS-STARTPTS', *ENC, '-an', out])
    return speed
info = {}
for k in order:
    sc = SCENES[k]; shots = sc['shots']; T = total[k]
    fixed = sum(s[3] for s in shots if s[3]); n_free = sum(1 for s in shots if not s[3])
    free = (T + X * (len(shots) - 1) - fixed) / max(n_free, 1)
    parts = []
    for i, (name, ss, sp, d) in enumerate(shots):
        d = d or free; out = f'{B}/{k}_{i}.mp4'
        s = shot(name, ss, sp, d, out); parts.append((out, d)); info.setdefault(k, []).append((name, round(d, 2), round(s, 2)))
    # chain xfades inside the scene
    if len(parts) == 1: src = parts[0][0]
    else:
        inputs = sum([['-i', p] for p, _ in parts], []); fc = []; last = '[0:v]'; off = 0
        for i in range(1, len(parts)):
            off += parts[i-1][1] - X; lab = f'[x{i}]'
            fc.append(f'{last}[{i}:v]xfade=transition=fade:duration={X}:offset={off:.3f}{lab}'); last = lab
        src = f'{B}/{k}_chain.mp4'
        run(['ffmpeg','-y','-v','error',*inputs,'-filter_complex',';'.join(fc),'-map',last, *ENC, src])
    out = f'{B}/scene_{k}.mp4'
    # Captions sit in the top band (over the app's top bar), never over the chat composer at the bottom.
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
