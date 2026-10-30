# Demo v4 pipeline

The pipeline has four stages: narration, recordings, music and sound, then compositing. Run it from this folder.

## Setup
- **Python 3.11+ virtualenv:**
  ```bash
  pip install numpy scipy soundfile opencv-python-headless pillow kokoro-onnx sherpa-onnx
  ```
- **Models, into `av/models/`:**
  - `kokoro-v1.0.onnx` and `voices-v1.0.bin`, from github.com/thewh1teagle/kokoro-onnx, release `model-files-v1.0`.
  - Optional, for the transcription check: `sherpa-onnx-whisper-base.en`, from github.com/k2-fsa/sherpa-onnx, release `asr-models`.
- **Playwright with Chromium** for the recorder.
- **Built apps:** `apps/web` and `apps/admin` built with `next build --webpack`.

## Steps
1. **Narration.**
   ```bash
   python av/vo.py af_heart 0.92
   ```
   This writes `av/vo/*.wav` and `av/vo/timing.json`, the timing everything else follows. `python av/asr.py av/vo/*.wav` transcribes each scene, as a check.
2. **Cards and recordings.**
   - Serve `video/cards/` on port 8899 (for example `python -m http.server 8899`).
   - Start the API, web and admin with the clock pinned: `FAKE_NOW=2026-10-15T06:00:00Z` and `NODE_OPTIONS="--require $(pwd)/video/fake-now.cjs"`, on ports 8787, 3000 and 3001.
   - Run the recorder:
     ```bash
     FAKE_NOW=2026-10-15T06:00:00Z node video/rec2.cjs title,b,g,e,f,c,d,closing
     ```
   - This writes `video/clips2/*.mp4` (2880x1440) and `*.events.json`.
   - Scene `c` posts an assignment, so keep this order, or restart the API before re-recording `e`/`f`.
3. **Music and mix.**
   ```bash
   python av/music.py
   python av/mix.py
   ```
   This writes `av/music.wav` and `av/mix.wav` (at −16 LUFS), plus `av/sfx-cues.json`.
4. **Picture.**
   - Preview single frames: `python av/comp.py preview 20,40,60`.
   - Render the video:
     ```bash
     python av/comp.py render av/build/video.mp4
     ```
   - Add the soundtrack:
     ```bash
     ffmpeg -i av/build/video.mp4 -i av/mix.wav -map 0:v -map 1:a -c:v libx264 -preset slower -crf 27 -maxrate 2400k -bufsize 4800k -c:a aac -b:a 144k -shortest -movflags +faststart murshid-demo.mp4
     ```

`av/timeline.py` holds the timing. To re-time a scene or move the camera, edit:
- the scene order, transitions and captions;
- the anchors that map each recording onto the narration;
- the camera moves (`CAM`).

To swap the voice (for example for an ElevenLabs take), replace `av/vo/<scene>.wav` and update `av/vo/timing.json` with the new line timings, then re-run steps 3 and 4.
