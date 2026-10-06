# usage: python freeloop.py <file> <lmin> <lmax> [top] [maxstart]
# Free search: every lag L (23 ms grid) and start s, scored by feature similarity of [s-2, s+2] with [s+L-2, s+L+2];
# the top windows are refined at sample level and checked by waveform correlation before/at/after the seam.
import sys
import numpy as np
from analyze import decode, features, lag_similarity, refine, SR, HOP

f = sys.argv[1]
lmin, lmax = float(sys.argv[2]), float(sys.argv[3])
top = int(sys.argv[4]) if len(sys.argv) > 4 else 10
maxstart = float(sys.argv[5]) if len(sys.argv) > 5 else 1e9
x = decode(f)
fps = SR / HOP
logmel, chroma, flux = features(x)
dur = len(x) / SR
sims = lag_similarity(logmel, chroma, flux, lmin, lmax, fps)
w = int(2 * fps)
k = np.ones(2 * w + 1) / (2 * w + 1)
cands = []
for L, sim in sims.items():
    seam = np.convolve(sim, k, mode='same')
    lo = int(2.2 * fps)
    hi = min(len(seam) - int(2.2 * fps), int(maxstart * fps))
    if hi <= lo:
        continue
    j = lo + int(np.argmax(seam[lo:hi]))
    cands.append((float(seam[j]), j, L))
cands.sort(reverse=True)
picked = []
for sc, j, L in cands:
    if all(abs(L - L2) > 0.5 * fps or abs(j - j2) > 4 * fps for _, j2, L2 in picked):
        picked.append((sc, j, L))
    if len(picked) >= top * 3:
        break
x48 = decode(f, 48000)
sr = 48000
def wcorr(s, L, off):
    a0 = int((s + off) * sr)
    seg = x48[a0:a0 + int(1.5 * sr)].astype(np.float64)
    c0 = int((s + L + off) * sr)
    if a0 < 0 or c0 + len(seg) + 1500 > len(x48):
        return None
    region = x48[c0 - 1440:c0 + 1440 + len(seg)].astype(np.float64)
    corr = np.correlate(region, seg, mode='valid')
    cs = np.concatenate([[0], np.cumsum(region ** 2)])
    e = np.sqrt(cs[len(seg):] - cs[:-len(seg)]) * np.sqrt((seg ** 2).sum()) + 1e-9
    return round(float(np.max(corr / e)), 2)
out = []
for sc, j, L in picked:
    s = j * HOP / SR
    # snap to the strongest onset within ±0.1 s
    r = int(0.1 * fps)
    j2 = max(0, j - r) + int(np.argmax(flux[max(0, j - r):j + r]))
    s = j2 * HOP / SR
    Lr, nc = refine(x48, s, L / fps, search=0.03)
    cs = [wcorr(s, Lr, o) for o in (-1.5, 0, 1.5)]
    score = sum(c for c in cs if c is not None)
    out.append((score, s, Lr, sc, cs))
out.sort(reverse=True)
print(f"{f} dur {dur:.2f}")
for score, s, Lr, sc, cs in out[:top]:
    print(f"  s {s:7.3f}  L {Lr:7.3f}  feat {sc:.3f}  wave[-1.5,0,+1.5] {cs}")
