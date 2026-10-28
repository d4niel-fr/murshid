#!/bin/sh
# Edge neural TTS (en-GB-RyanNeural, +6%) for each narration line -> /workspace/work/demo2/vo/<scene>.mp3
V=${1:-en-GB-RyanNeural}
cd /workspace/work/demo2 && mkdir -p vo
PYTHONPATH=/workspace/work/pylib5 python3 - "$V" <<'PY'
import json,subprocess,sys
v=sys.argv[1]
for k,t in json.load(open('/workspace/murshid/docs/demo/recorder/v2/narration.json')):
    subprocess.run(['python3','-m','edge_tts','--voice',v,'--rate','+6%','--text',t,'--write-media',f'vo/{k}.mp3'],check=True)
PY
