#!/bin/sh
# Edge neural TTS for each v3 narration line -> /workspace/work/demo3/vo/<scene>.mp3
# Same pipeline as v2 (en-GB-RyanNeural, +6%); the committed v3 audio was generated before this script was added.
V=${1:-en-GB-RyanNeural}
cd /workspace/work/demo3 && mkdir -p vo
PYTHONPATH=/workspace/work/pylib5 python3 - "$V" <<'PY'
import json,subprocess,sys
v=sys.argv[1]
for k,t in json.load(open('/workspace/murshid/docs/demo/recorder/v3/narration.json')):
    subprocess.run(['python3','-m','edge_tts','--voice',v,'--rate','+6%','--text',t,'--write-media',f'vo/{k}.mp3'],check=True)
PY
