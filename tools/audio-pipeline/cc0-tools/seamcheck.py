# usage: python seamcheck.py <file> <start> <length> [...more start length pairs]
# For a loop window [s, s+L): normalised waveform correlation (best lag within ±30 ms) of the audio around s with the
# audio around s+L, in 1.5 s windows at offsets -3, -1.5, 0, +1.5, +3 s. ≈1 everywhere = the music really repeats.
import sys
import numpy as np
from analyze import decode

f = sys.argv[1]
x = decode(f, 48000)
sr = 48000
args = list(map(float, sys.argv[2:]))
for s, L in zip(args[0::2], args[1::2]):
    res = []
    for off in (-3, -1.5, 0, 1.5, 3):
        a0 = int((s + off) * sr)
        if a0 < 0:
            res.append(None)
            continue
        seg = x[a0:a0 + int(1.5 * sr)]
        c0 = int((s + L + off) * sr)
        lo, hi = c0 - int(0.03 * sr), c0 + int(0.03 * sr)
        if hi + len(seg) > len(x):
            res.append(None)
            continue
        region = x[lo:hi + len(seg)].astype(np.float64)
        corr = np.correlate(region, seg.astype(np.float64), mode='valid')
        cs = np.concatenate([[0], np.cumsum(region ** 2)])
        e = np.sqrt(cs[len(seg):] - cs[:-len(seg)]) * np.sqrt((seg.astype(np.float64) ** 2).sum()) + 1e-9
        nc = corr / e
        i = int(np.argmax(nc))
        res.append((round(float(nc[i]), 2), round((lo + i - c0) / sr * 1000, 1)))
    print(f"s {s:.3f} L {L:.3f}  [-3, -1.5, 0, +1.5, +3] -> {res}")
