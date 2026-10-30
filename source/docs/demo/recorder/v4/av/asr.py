import sys, numpy as np, soundfile as sf, sherpa_onnx
from scipy.signal import resample_poly
M = 'models/sherpa-onnx-whisper-base.en'
rec = sherpa_onnx.OfflineRecognizer.from_whisper(encoder=f'{M}/base.en-encoder.onnx', decoder=f'{M}/base.en-decoder.onnx', tokens=f'{M}/base.en-tokens.txt', num_threads=4)
for p in sys.argv[1:]:
    a, sr = sf.read(p, dtype='float32')
    if a.ndim > 1: a = a.mean(1)
    if sr != 16000: a = resample_poly(a, 16000, sr).astype(np.float32)
    # whisper takes up to 30 s per pass
    out = []
    for i in range(0, len(a), 16000 * 28):
        s = rec.create_stream(); s.accept_waveform(16000, a[i:i + 16000 * 28]); rec.decode_stream(s); out.append(s.result.text.strip())
    print(p.split('/')[-1], '|', ' '.join(out))
