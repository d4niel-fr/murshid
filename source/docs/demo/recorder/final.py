import json, subprocess
D='/workspace/work/demo'; B=f'{D}/build'; X=0.4
t=json.load(open(f'{B}/timing.json')); order='abcdefg'; T=t['total']
def run(a):
    r=subprocess.run(a,capture_output=True,text=True)
    if r.returncode: print(r.stderr[-3000:]); raise SystemExit(1)
offs={}; o=0
for k in order: offs[k]=o; o+=T[k]-X
L=offs['g']+T['g']
# soft synth pad: Cmaj7 <-> Am7 blended by a slow cosine, gentle tremolo; mixed far under the voice
c1='(sin(2*PI*130.81*t)+sin(2*PI*164.81*t)+sin(2*PI*196*t)+0.6*sin(2*PI*246.94*t))'
c2='(sin(2*PI*110*t)+sin(2*PI*130.81*t)+sin(2*PI*164.81*t)+0.6*sin(2*PI*196*t))'
w='(0.5+0.5*cos(2*PI*t/16))'
expr=f"0.05*({w}*{c1}+(1-{w})*{c2})*(0.8+0.2*sin(2*PI*t/5))"
run(['ffmpeg','-y','-v','error','-f','lavfi','-i',f"aevalsrc='{expr}':s=44100:d={L+1:.2f}",
     '-af',f'lowpass=f=1200,aecho=0.8:0.7:120|240:0.25|0.15,afade=t=in:d=2.5,afade=t=out:st={L-3:.2f}:d=3,volume=0.55,pan=stereo|c0=c0|c1=c0','-ar','44100',f'{B}/pad.wav'])
inputs=[]; 
for k in order: inputs+=['-i',f'{B}/scene_{k}.mp4']
for k in order: inputs+=['-i',f'{D}/vo/{k}.mp3']
inputs+=['-i',f'{B}/pad.wav']
fc=[]; last='[0:v]'
for i,k in enumerate(order[1:],1):
    lab=f'[v{i}]'; fc.append(f'{last}[{i}:v]xfade=transition=fade:duration={X}:offset={offs[k]:.3f}{lab}'); last=lab
fc.append(f'{last}fade=t=out:st={L-0.8:.2f}:d=0.8[vout]')
vlabels=[]
for i,k in enumerate(order):
    d=int((offs[k]+(0.3 if k=='a' else 0.35))*1000)
    fc.append(f'[{7+i}:a]aresample=44100,aformat=channel_layouts=stereo,adelay={d}|{d}[a{i}]'); vlabels.append(f'[a{i}]')
fc.append(f"{''.join(vlabels)}amix=inputs=7:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[voice]")
fc.append('[14:a]volume=1.0[pad]')
fc.append(f'[voice][pad]amix=inputs=2:normalize=0:duration=first,atrim=0:{L:.3f}[aout]')
run(['ffmpeg','-y','-v','error',*inputs,'-filter_complex',';'.join(fc),'-map','[vout]','-map','[aout]',
     '-c:v','libx264','-preset','veryfast','-crf','20','-pix_fmt','yuv420p','-r','30','-c:a','aac','-b:a','160k','-movflags','+faststart','-t',f'{L:.3f}',f'{B}/murshid-demo.mp4'])
json.dump({'offsets':offs,'length':L},open(f'{B}/offsets.json','w'),indent=1)
print(offs, L)
