"""Kelvyre idle, v2: the original 128 sprite is puppeted by a smooth displacement field (breath, head sway, fire-hand
bob, tail swish; the feet never move) and sampled nearest, so it stays on its pixel grid. The flames and frost
sparkles come from the gpt-image frames, warped by the same field and palette-locked to the original flame colours.

    python compose_idle.py <front|back> <out-prefix> <N> <calm.npy> <flare.npy> [--rest]   (both sliced by slice_frames.py, PAD 32)

With --rest the field is zero: rest-pose frames with the AI flames, for rig_idle.py to animate.
"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage
side, out, N = sys.argv[1], sys.argv[2], int(sys.argv[3])
calm, flare = np.load(sys.argv[4]).astype(int), np.load(sys.argv[5]).astype(int)
# per side, in the original sprite's coordinates: where the body (not the tail) is, the fire hand, the tail tip's
# reach, and the flame zones (head crest, hand, elbow / shoulder, tail tip)
SIDES = {
    'front': dict(body=lambda U: np.clip((92 + 4 - U) / 8, 0, 1), hand=(24, 34),
                  tail=lambda U, V: np.clip((U - 88) / 12, 0, 1) * np.clip((104 - V) / 32, 0, 1),
                  zones=[(41, 64, -32, 24), (2, 40, -32, 48), (31, 51, 28, 56), (86, 120, 46, 102)],
                  anchors={0: 20, 1: 42}),
    'back': dict(body=lambda U: np.clip((U - 36) / 8, 0, 1), hand=(102, 42),
                 tail=lambda U, V: np.clip((44 - U) / 14, 0, 1) * np.clip((112 - V) / 30, 0, 1),
                 zones=[(68, 90, -32, 22), (88, 126, -32, 54), (76, 98, 30, 58), (6, 38, 52, 106)],
                 anchors={0: 18, 1: 41}),
}
CFG = SIDES[side]
PAD = 32  # headroom rows for tall flames
o = np.zeros((128 + PAD, 128, 4), int)
o[PAD:] = np.asarray(Image.open(f"assets-src/imagegen/kelvyre-anim/stills/kelvyre({side}).png").convert('RGBA')).astype(int)
V, U = np.mgrid[0:128 + PAD, 0:128].astype(float)
V -= PAD  # field and zones in the original sprite's coordinates
HIP = 74
# The sprite pipeline places every page with the static frame's transform and refuses a page outside the 1024 cell:
# for Kelvyre that leaves 8 rows above the head (static bbox top 3). Flames taller than that are squashed down to
# TOP_LIMIT, anchored at their base (`anchors`: zone index -> base row of the hand flame / head crest).
TOP_LIMIT = -5

def flamey(p): return (p[..., 3] > 0) & (p[..., 0] > 190) & (p[..., 1] > 80) & (p[..., 2] < 130)
def dark(p): return (p[..., 3] > 0) & (p[..., :3].sum(-1) < 200)

REST = '--rest' in sys.argv  # flames and sparkles only, body unmoved: rig_idle.py does the motion

def field(t):
    if REST:
        return np.zeros_like(U), np.zeros_like(V)
    p = 2 * np.pi * t / N
    wx = CFG['body'](U)                                          # body side, not the tail
    up = np.clip((HIP - V) / (HIP - 12), 0, 1)                   # 0 at the hips, 1 at the head
    breath = 0.5 - 0.5 * np.cos(2 * p)                           # two breaths per loop
    dy = -2.0 * breath * up * wx
    dx = 1.2 * np.sin(p) * np.clip((44 - V) / 30, 0, 1) * wx     # head and shoulders sway once per loop
    hu, hv = CFG['hand']
    hand = np.exp(-((U - hu) ** 2 + (V - hv) ** 2) / (2 * 10.0 ** 2))
    dy += 1.6 * np.sin(2 * p + 1.3) * hand                       # the fire hand bobs, a beat after the breath
    dx += 0.8 * np.cos(2 * p + 1.3) * hand
    wt = CFG['tail'](U, V)
    dx += 2.2 * np.sin(p - np.pi / 2) * wt                       # the tail swishes, a quarter loop behind
    dy += -1.2 * (0.5 - 0.5 * np.cos(2 * p - np.pi)) * wt
    return dx, dy

def warp(img, dx, dy):
    su = np.clip(np.round(U - dx), 0, 127).astype(int); sv = np.clip(np.round(V + PAD - dy), 0, 127 + PAD).astype(int)
    return img[sv, su]

ZONES = CFG['zones']
ZONES = [(u0, u1, v0 + PAD, v1 + PAD) for u0, u1, v0, v1 in ZONES]
zone = np.zeros((128 + PAD, 128), bool)
for u0, u1, v0, v1 in ZONES: zone[v0:v1, u0:u1] = True
pal = np.array(sorted(set(map(tuple, o[ndimage.binary_dilation(flamey(o) & zone) & (o[..., 3] > 0)][:, :3]))))
def lock(c): return pal[np.argmin(((pal[None] - c[:, None]) ** 2).sum(-1), 1)]
body0 = o[..., 3] > 0
sil = ndimage.binary_dilation(body0, iterations=2)

# flare frames ordered small -> peak -> small by flame area, so the flare ramps instead of popping in
area = [flamey(f).sum() for f in flare]
by = list(np.argsort(area)); ramp = by[0::2] + by[1::2][::-1]
print('flare order', [i + 1 for i in ramp])
# per 8 frames: calm, flare, calm, calm, flare, calm (flares peak on the two breaths, t = 12 and 36)
SCHED = ['c', 'f', 'c', 'c', 'f', 'c']
def flame_frame(t):
    seg, j = SCHED[(t // 8) % len(SCHED)], t % 8
    return calm[j] if seg == 'c' else flare[ramp[j]]
def squash(G, v0, anchor, limit):
    """Scale the zone's AI layer vertically about `anchor` (nearest) so its highest flame pixel lands on `limit`."""
    f = flamey(G)
    rows = np.nonzero(f.any(1))[0]
    if len(rows) == 0 or rows.min() + v0 >= limit:
        return G, f
    top = rows.min() + v0
    s = (anchor - top) / (anchor - limit)
    out = G.copy()
    for r in range(G.shape[0]):
        a = r + v0
        if a > anchor:
            break
        src = anchor - (anchor - a) * s
        out[r] = G[int(round(src)) - v0] if src >= v0 else 0
    return out, flamey(out)

frames = []
for t in range(N):
    dx, dy = field(t)
    base = warp(o, dx, dy); g = warp(flame_frame(t), dx, dy)
    bf, gf = flamey(base), flamey(g)
    R = base.copy()
    for u0, u1, v0, v1 in ZONES:
        sl = (slice(v0, v1), slice(u0, u1))
        B, G, Bf, Gf = base[sl], g[sl], bf[sl], gf[sl]
        zi = ZONES.index((u0, u1, v0, v1))
        if zi in CFG['anchors']:
            G, Gf = squash(G, v0, CFG['anchors'][zi] + PAD, TOP_LIMIT + PAD)
        Z = B.copy()
        Z[Gf] = G[Gf]
        gone = Bf & ~Gf
        Z[gone] = np.where(dark(G)[gone][:, None], G[gone], 0)
        edge = ndimage.binary_dilation(Gf) & dark(G) & (B[..., 3] == 0)
        Z[edge] = G[edge]
        body = (B[..., 3] > 0) & ~Bf & ~Gf
        Z[body] = B[body]
        Z[Gf, :3] = lock(Z[Gf, :3])
        R[sl] = Z
    # frost sparkles: small near-white shapes the AI drew off the body, kept whole (not cut by the halo test)
    white = (g[..., 3] > 0) & (g[..., 0] > 215) & (g[..., 2] > 215) & (g[..., 1] > 180) & ~body0 & (V < 95)  # magenta fringe allowed
    lab, n = ndimage.label(white)
    for i in range(1, n + 1):
        m = lab == i
        if m.sum() <= 12 and (m & ~sil).any():
            R[m] = (255, 255, 255, 255)
    R[..., 3] = np.where(R[..., 3] > 0, 255, 0)
    frames.append(R.astype(np.uint8))
A = np.stack(frames); np.save(out + '.npy', A)
for z in (1, 2):
    ims = [Image.fromarray(a).resize((128 * z, (128 + PAD) * z), Image.NEAREST) for a in A]
    ims[0].save(f'{out}-{128 * z}.gif', save_all=True, append_images=ims[1:], duration=100, loop=0, disposal=2)
print('frames', len(A))
