# usage: python describe.py <glob>... : per file duration, spectral centroid (Hz), median f0 (Hz, 0 = unpitched), loudness-ish
import sys, glob
import numpy as np
from analyze import decode
SR = 22050
for pat in sys.argv[1:]:
    for f in sorted(glob.glob(pat)):
        x = decode(f, SR)
        if len(x) < 512:
            continue
        thr = 10 ** (-40 / 20) * np.max(np.abs(x))
        nz = np.where(np.abs(x) > thr)[0]
        x = x[nz[0]:nz[-1] + 1] if len(nz) else x
        S = np.abs(np.fft.rfft(x * np.hanning(len(x))))
        fr = np.fft.rfftfreq(len(x), 1 / SR)
        cen = float((S * fr).sum() / (S.sum() + 1e-9))
        # f0 via autocorrelation over 30 ms frames
        f0s = []
        n = int(0.04 * SR)
        for i in range(0, len(x) - n, n):
            fr_ = x[i:i + n] - x[i:i + n].mean()
            if np.sqrt(np.mean(fr_ ** 2)) < 0.02:
                continue
            ac = np.correlate(fr_, fr_, 'full')[n - 1:]
            lo, hi = int(SR / 1000), int(SR / 70)
            k = lo + int(np.argmax(ac[lo:hi]))
            if ac[k] > 0.5 * ac[0]:
                f0s.append(SR / k)
        f0 = float(np.median(f0s)) if len(f0s) >= 2 else 0
        voiced = len(f0s) / max(1, (len(x) - n) // n)
        peak = 20 * np.log10(np.max(np.abs(x)) + 1e-9)
        rms = 20 * np.log10(np.sqrt(np.mean(x ** 2)) + 1e-9)
        print(f"{f.replace(chr(92), '/'):70s} {len(x)/SR:5.2f}s cen {cen:6.0f} f0 {f0:6.0f} voiced {voiced:.2f} pk {peak:5.1f} rms {rms:5.1f}")
