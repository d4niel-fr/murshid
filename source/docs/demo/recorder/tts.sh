#!/bin/sh
V=${1:-en-GB-RyanNeural}
cd /workspace/work/demo
python3 - "$V" <<'PY'
import json,subprocess,sys
v=sys.argv[1]
for k,t in json.load(open('narration.json')):
    subprocess.run(['python3','-m','edge_tts','--voice',v,'--rate','+6%','--text',t,'--write-media',f'vo/{k}.mp3'],check=True)
PY
