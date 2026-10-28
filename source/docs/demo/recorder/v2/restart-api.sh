#!/bin/sh
for p in $(ps aux | grep -E "tsx.*src/node.ts|tsx/dist/cli.mjs src/node" | grep -v grep | awk '{print $2}'); do kill $p; done
sleep 2
cd /workspace/murshid/apps/api && GATEWAY_MODE=mock OPENROUTER_API_KEY= PORT=8787 setsid nohup npx tsx src/node.ts > /tmp/api.log 2>&1 < /dev/null &
sleep 6; cat /tmp/api.log
