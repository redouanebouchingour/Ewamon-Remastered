"""Slice a 4x2 gpt-image sheet back onto the original sprite's art grid, on a canvas with PAD rows of headroom for
tall flames. Each cell is pre-aligned by its lower-body bounding box, then registered (scale and offset) on the legs,
and every art pixel is the majority colour of its block.

    python slice_frames.py <sprite128.png> <sheet.png> <out.npy>   (the stills live in assets-src/imagegen/kelvyre-anim/stills/)"""
import sys, numpy as np
from collections import Counter
from PIL import Image
sprite, sheet, out = sys.argv[1], sys.argv[2], sys.argv[3]
PAD = 32
o128 = np.asarray(Image.open(sprite).convert('RGBA')).astype(int)
orig = np.zeros((128 + PAD, 128, 4), int); orig[PAD:] = o128
_ys, _xs = np.nonzero(o128[..., 3])
X0, Y0, CW, CH = _xs.min(), _ys.min() + PAD, _xs.max() + 1 - _xs.min(), _ys.max() + 1 - _ys.min()
S = np.asarray(Image.open(sheet).convert('RGB')).astype(int)
def is_mag(a): r, g, b = a[..., 0], a[..., 1], a[..., 2]; return (r > 150) & (b > 150) & (g < 120)
V, U = np.mgrid[0:128 + PAD, 0:128]
legs = (orig[..., 3] > 0) & (V > Y0 + CH * 0.45)
def sample(ox, oy, k, maj=False):
    f = np.zeros((128 + PAD, 128, 4), int)
    xs = ox + (U - X0 + 0.5) * k; ys = oy + (V - Y0 + 0.5) * k
    ok = (xs >= 2) & (ys >= 2) & (xs < S.shape[1] - 2) & (ys < S.shape[0] - 2)
    if not maj:
        c = S[ys.clip(0, S.shape[0] - 1).astype(int), xs.clip(0, S.shape[1] - 1).astype(int)]
        f[..., :3] = c; f[..., 3] = np.where(ok & ~is_mag(c), 255, 0); return f
    h = k / 2
    for v, u in zip(*np.nonzero(ok)):
        blk = S[int(round(ys[v, u] - h)):int(round(ys[v, u] + h)), int(round(xs[v, u] - h)):int(round(xs[v, u] + h))].reshape(-1, 3)
        mg = is_mag(blk)
        if mg.mean() >= 0.5: continue
        f[v, u, :3] = Counter(map(tuple, blk[~mg])).most_common(1)[0][0]; f[v, u, 3] = 255
    return f
def err(f): return np.abs(f[..., :3] - orig[..., :3]).sum(-1)[legs].mean() + 400 * np.mean(f[..., 3][legs] == 0)
# lower-body box of the original, in sheet pixels at 3x
ly, lx = np.nonzero(legs); ref_box = (lx.min() - X0) * 3, (ly.max() + 1 - Y0) * 3, (lx.max() + 1 - X0) * 3
frames = []
for i in range(8):
    x0c, y0c = (i % 4) * 384, (i // 4) * 512
    cell = ~is_mag(S[y0c:y0c + 512, x0c:x0c + 384])
    rows = np.nonzero(cell.any(1))[0]; bot = rows.max() + 1
    low = cell[int(bot - CH * 3 * 0.55):bot]; cx_ = np.nonzero(low.any(0))[0]
    # left edge of the legs/tail band -> where crop-x 0 sits; bottom -> where crop-y CH sits
    ox0 = x0c + cx_.min() - ref_box[0]; oy0 = y0c + bot - CH * 3
    best = None
    for k in np.arange(2.90, 3.12, 0.02):
        for dy in range(-8, 9, 2):
            for dx in range(-10, 11, 2):
                ox = ox0 + dx; oy = oy0 + dy - (k - 3) * CH
                e = err(sample(ox, oy, k))
                if best is None or e < best[0]: best = (e, k, ox, oy)
    e, k, ox, oy = best
    for kk in np.arange(k - 0.02, k + 0.021, 0.005):
        for ddy in np.arange(-2, 2.1, 0.5):
            for ddx in np.arange(-2, 2.1, 0.5):
                e2 = err(sample(ox + ddx, oy + ddy, kk))
                if e2 < best[0]: best = (e2, kk, ox + ddx, oy + ddy)
    e, k, ox, oy = best
    frames.append(sample(ox, oy, k, maj=True).astype(np.uint8)); print('frame', i + 1, 'k=%.3f' % k, 'err %.1f' % e, flush=True)
np.save(out, np.stack(frames))
