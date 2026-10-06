# usage: python onsets.py <file> [t0 t1] : strongest onsets (time, strength) and 0.5 s loudness, for picking excerpts
import sys
import numpy as np
from analyze import decode, features, SR, HOP
f = sys.argv[1]
x = decode(f)
t0 = float(sys.argv[2]) if len(sys.argv) > 2 else 0
t1 = float(sys.argv[3]) if len(sys.argv) > 3 else len(x) / SR
x = x[int(t0 * SR):int(t1 * SR)]
lm, ch, fl = features(x)
fps = SR / HOP
o = fl - np.convolve(fl, np.ones(43) / 43, mode='same')
peaks = [i for i in range(1, len(o) - 1) if o[i] > o[i - 1] and o[i] >= o[i + 1] and o[i] > 0]
peaks.sort(key=lambda i: -o[i])
top = sorted(peaks[:25])
print(f, 'onsets:', ' '.join(f"{t0 + i / fps:.2f}({o[i]:.0f})" for i in top))
hs = int(0.5 * SR)
print('loud(0.5s dB):', ' '.join(f"{t0 + i / SR:.1f}:{20 * np.log10(np.sqrt(np.mean(x[i:i + hs] ** 2)) + 1e-9):.0f}" for i in range(0, len(x) - hs, hs)))
