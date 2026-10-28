#!/bin/sh
# Full rebuild of murshid-demo-v2.mp4: fresh API state -> record all clips -> TTS -> assemble scenes -> final mix.
set -e
D=/workspace/murshid/docs/demo/recorder/v2
sh $D/restart-api.sh
cd $D && CHROMIUM=${CHROMIUM:-/usr/bin/chromium} PYTHONPATH=${PYTHONPATH:-/workspace/work/pylib4} python3 scenes_v2.py
sh $D/tts.sh
python3 $D/assemble_v2.py
python3 $D/final_v2.py
