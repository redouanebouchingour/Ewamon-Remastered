# Phase E4 helper (gitignored): tempo + self-similarity loop finder for the CC0 music tracks.
# usage: python analyze.py <file> [--lmin S] [--lmax S] [--top N]
# Prints duration, tempo candidates, and the best (start, length) loop windows: windows whose surroundings at
# t and t+L match (chroma + log-mel + onset), refined at sample level by waveform cross-correlation.
import subprocess, sys, json, argparse
import numpy as np

SR = 22050
N_FFT = 2048
HOP = 512


def decode(path, sr=SR, mono=True):
    cmd = ['ffmpeg', '-v', 'error', '-i', path, '-ac', '1' if mono else '2', '-ar', str(sr), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    x = np.frombuffer(raw, dtype=np.float32)
    return x if mono else x.reshape(-1, 2).T


def stft_mag(x):
    win = np.hanning(N_FFT).astype(np.float32)
    n = 1 + (len(x) - N_FFT) // HOP
    idx = np.arange(N_FFT)[None, :] + HOP * np.arange(n)[:, None]
    return np.abs(np.fft.rfft(x[idx] * win, axis=1)).astype(np.float32)  # frames x bins


def mel_fb(nb=40):
    f = np.fft.rfftfreq(N_FFT, 1 / SR)
    mel = lambda h: 2595 * np.log10(1 + h / 700)
    imel = lambda m: 700 * (10 ** (m / 2595) - 1)
    pts = imel(np.linspace(mel(40), mel(10000), nb + 2))
    fb = np.zeros((nb, len(f)), np.float32)
    for i in range(nb):
        l, c, r = pts[i], pts[i + 1], pts[i + 2]
        fb[i] = np.clip(np.minimum((f - l) / (c - l), (r - f) / (r - c)), 0, None)
    return fb


def chroma_fb():
    f = np.fft.rfftfreq(N_FFT, 1 / SR)
    fb = np.zeros((12, len(f)), np.float32)
    ok = (f > 55) & (f < 4000)
    pc = np.round(12 * np.log2(f[ok] / 440.0)).astype(int) % 12
    fb[pc, np.where(ok)[0]] = 1
    return fb


def features(x):
    S = stft_mag(x)
    logmel = np.log1p(10 * S @ mel_fb().T)
    chroma = S @ chroma_fb().T
    chroma = chroma / (np.linalg.norm(chroma, axis=1, keepdims=True) + 1e-9)
    flux = np.maximum(0, np.diff(logmel, axis=0)).sum(axis=1)
    flux = np.concatenate([[0], flux])
    return logmel, chroma, flux


def tempo_candidates(flux, fps):
    o = flux - np.convolve(flux, np.ones(16) / 16, mode='same')
    o = np.maximum(o, 0)
    o = o - o.mean()
    ac = np.correlate(o, o, mode='full')[len(o) - 1:]
    ac /= ac[0] + 1e-9
    res = []
    for bpm in np.arange(55, 200.01, 0.05):
        lag = 60 * fps / bpm
        # comb: beat, 2 beats, 4 beats, 8 beats
        s = 0
        for k, w in ((1, 1.0), (2, 0.8), (4, 0.8), (8, 0.6), (16, 0.5)):
            L = lag * k
            if L >= len(ac) - 1:
                continue
            i = int(L)
            fr = L - i
            s += w * (ac[i] * (1 - fr) + ac[i + 1] * fr)
        res.append((s, bpm))
    res.sort(reverse=True)
    out = []
    for s, b in res:
        if all(abs(b - q) > 1.0 for _, q in out):
            out.append((s, b))
        if len(out) >= 6:
            break
    return [(round(b, 2), round(float(s), 3)) for s, b in out]


def lag_similarity(logmel, chroma, flux, lmin, lmax, fps):
    """mean similarity of frame t with t+L over the track, for every lag in frames"""
    lm = (logmel - logmel.mean(axis=0)) / (logmel.std(axis=0) + 1e-6)
    lm = lm / (np.linalg.norm(lm, axis=1, keepdims=True) + 1e-9)
    n = len(lm)
    out = {}
    for L in range(int(lmin * fps), min(int(lmax * fps), n - int(4 * fps)) + 1):
        a = (lm[:-L] * lm[L:]).sum(axis=1)
        c = (chroma[:-L] * chroma[L:]).sum(axis=1)
        out[L] = 0.5 * a + 0.5 * c
    return out


def seam_scores(sim_L, fps, w_sec=3.0):
    """local seam score around each start s: mean similarity in [s - w, s + w] (smoothed)"""
    w = int(w_sec * fps)
    k = np.ones(2 * w + 1) / (2 * w + 1)
    return np.convolve(sim_L, k, mode='same')


def refine(x48, s, L, sr=48000, search=0.03, win=1.5):
    """sample-level refinement of L by cross-correlating the waveform around s with the one around s+L"""
    a0 = int(s * sr)
    seg = x48[a0:a0 + int(win * sr)]
    best = (-2, L)
    c0 = int((s + L) * sr)
    lo, hi = c0 - int(search * sr), c0 + int(search * sr)
    if hi + len(seg) > len(x48):
        return L, 0.0
    region = x48[lo:hi + len(seg)]
    corr = np.correlate(region, seg, mode='valid')
    e_seg = np.sqrt((seg ** 2).sum())
    cs = np.concatenate([[0], np.cumsum(region.astype(np.float64) ** 2)])
    e_reg = np.sqrt(cs[len(seg):] - cs[:-len(seg)])
    nc = corr / (e_seg * e_reg + 1e-9)
    i = int(np.argmax(nc))
    return (lo + i - a0) / sr, float(nc[i])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('file')
    ap.add_argument('--lmin', type=float, default=12)
    ap.add_argument('--lmax', type=float, default=70)
    ap.add_argument('--top', type=int, default=8)
    ap.add_argument('--smin', type=float, default=1.0)
    ap.add_argument('--json', action='store_true')
    ap.add_argument('--bpm', type=float, nargs='*')
    ap.add_argument('--bars', type=int, nargs='*')
    ap.add_argument('--maxstart', type=float, default=1e9)
    a = ap.parse_args()
    x = decode(a.file)
    fps = SR / HOP
    logmel, chroma, flux = features(x)
    dur = len(x) / SR
    tempos = tempo_candidates(flux, fps)
    sims = lag_similarity(logmel, chroma, flux, a.lmin, a.lmax, fps)
    x48 = decode(a.file, 48000)
    cands = []
    tlist = [(b, 0) for b in a.bpm] if a.bpm else tempos[:3]
    for bpm, _ in tlist:
        beat = 60.0 / bpm
        for bars in (a.bars or range(2, 65)):
            Lsec = bars * 4 * beat
            if Lsec < a.lmin or Lsec > a.lmax or Lsec > dur - a.smin - 2:
                continue
            L = int(round(Lsec * fps))
            if L not in sims:
                continue
            seam = seam_scores(sims[L], fps)
            smin = int(a.smin * fps)
            valid = seam[smin:min(len(seam) - int(1 * fps), int(a.maxstart * fps))]
            if len(valid) == 0:
                continue
            # take the 3 best separated starts
            order = np.argsort(-valid)
            picked = []
            for j in order:
                if all(abs(j - p) > 2 * fps for p in picked):
                    picked.append(j)
                if len(picked) >= 3:
                    break
            for j in picked:
                j = j + smin
                r = int(0.12 * fps)
                lo, hi = max(0, j - r), min(len(flux), j + r)
                j2 = lo + int(np.argmax(flux[lo:hi]))
                s = j2 * HOP / SR
                if s + Lsec + 1.6 > dur:
                    continue
                Lref, nc = refine(x48, s, Lsec, search=max(0.03, 0.004 * Lsec))
                cands.append(dict(bpm=round(bars * 240 / Lref, 3), bars=bars, L=round(Lref, 4), glob=round(float(np.mean(sims[L])), 3),
                                  seam=round(float(seam[j]), 3), start=round(s, 3), xcorr=round(nc, 3)))
    cands.sort(key=lambda c: -(c['xcorr'] + c['seam']))
    out = dict(file=a.file, duration=round(dur, 3), tempos=tempos, loops=cands[:a.top])
    if a.json:
        print(json.dumps(out))
    else:
        print(f"{a.file}  dur {dur:.2f}s  tempo {tempos}")
        for c in cands[:a.top]:
            print(f"  bars {c['bars']:2d} L {c['L']:8.3f} bpm {c['bpm']:8.3f} start {c['start']:7.3f}  xc {c['xcorr']:.3f} seam {c['seam']:.3f} glob {c['glob']:.3f}")


if __name__ == '__main__':
    main()
