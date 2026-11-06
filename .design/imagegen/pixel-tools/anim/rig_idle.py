"""Kelvyre idle, v3: a 2D bone rig over the rest-pose frames of compose_idle.py --rest.

Bones are line segments in the 128 sprite's coordinates, each limited to a box. Every pixel belongs to its nearest
bone, softened into blend weights (linear blend skinning) by diffusing through the sprite's own pixels, so joints
bend instead of tearing. The legs are two-bone
IK chains whose feet stay where they are; the tail is a chain carrying a travelling wave. The frame is upscaled 8x
with EPX (three passes), every opaque sub-pixel is pushed forward through the skin, and each output pixel takes the majority colour
of the sub-pixels that land on it from the front-most part covering it (`DEPTH`; opaque when sub-pixels cover at
least half of it): rotated limbs keep clean pixel edges, overlapping parts do not interleave, and folds cannot pull in
stray pixels the way an inverted skin does.

    python rig_idle.py <front|back> <rest.npy> <out-prefix> [--labels]
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

side, src, out = sys.argv[1], sys.argv[2], sys.argv[3]
PAD = 32  # rest frames carry 32 rows of headroom (compose_idle.py)

# name: (parent, pivot, segment end, box (u0, v0, u1, v1)); coordinates of the 128 still, before PAD
RIGS = {
    'front': {
        'pelvis': (None, (56, 80), (60, 86), (40, 70, 80, 92)),
        'torso': ('pelvis', (57, 76), (58, 46), (42, 38, 74, 80)),
        'head': ('torso', (60, 42), (60, 12), (38, -32, 86, 44)),
        'fireU': ('torso', (47, 50), (34, 66), (26, 42, 52, 78)),
        'fireF': ('fireU', (34, 66), (24, 46), (4, -32, 40, 72)),
        'iceU': ('torso', (72, 48), (80, 68), (66, 30, 94, 72)),
        'iceL': ('iceU', (80, 68), (83, 90), (72, 62, 94, 94)),
        'thighF': ('pelvis', (50, 84), (46, 98), (34, 80, 58, 102)),
        'shinF': ('thighF', (46, 98), (42, 113), (28, 96, 56, 117)),
        'footF': (None, (42, 113), (38, 120), (24, 112, 58, 128)),
        'thighI': ('pelvis', (64, 84), (68, 100), (58, 80, 80, 102)),
        'shinI': ('thighI', (68, 100), (70, 114), (58, 96, 82, 117)),
        'footI': (None, (70, 114), (70, 121), (56, 112, 84, 128)),
        'tail1': ('pelvis', (80, 90), (88, 104), (76, 84, 96, 110)),
        'tail2': ('tail1', (88, 104), (98, 112), (84, 100, 104, 120)),
        'tail3': ('tail2', (98, 112), (107, 102), (94, 94, 116, 120)),
        'tail4': ('tail3', (107, 102), (104, 82), (90, 52, 122, 104)),
    },
    'back': {
        'pelvis': (None, (68, 80), (66, 88), (52, 70, 86, 92)),
        'torso': ('pelvis', (69, 76), (70, 46), (56, 38, 84, 80)),
        'head': ('torso', (70, 42), (74, 12), (50, -32, 92, 44)),
        'fireU': ('torso', (82, 50), (90, 66), (78, 30, 98, 76)),
        'fireF': ('fireU', (90, 66), (104, 48), (92, -32, 124, 72)),
        'iceU': ('torso', (58, 48), (50, 66), (36, 30, 64, 72)),
        'iceL': ('iceU', (50, 66), (50, 90), (36, 62, 60, 96)),
        'thighF': ('pelvis', (74, 84), (80, 100), (68, 80, 92, 102)),
        'shinF': ('thighF', (80, 100), (86, 114), (72, 96, 96, 117)),
        'footF': (None, (86, 114), (92, 120), (72, 112, 100, 128)),
        'thighI': ('pelvis', (62, 86), (60, 104), (52, 80, 70, 106)),
        'shinI': ('thighI', (60, 104), (58, 116), (50, 100, 68, 118)),
        'footI': (None, (58, 116), (58, 122), (48, 114, 68, 128)),
        'tail1': ('pelvis', (62, 96), (50, 110), (44, 90, 66, 116)),
        'tail2': ('tail1', (50, 110), (34, 116), (28, 104, 54, 124)),
        'tail3': ('tail2', (34, 116), (22, 106), (12, 98, 40, 124)),
        'tail4': ('tail3', (22, 106), (22, 84), (8, 52, 36, 108)),
    },
}
RIG = RIGS[side]
# draw order where parts overlap (higher in front): tail, far leg, near leg, body, head, far arm, near arm
DEPTH = {
    'front': dict(tail1=0, tail2=0, tail3=0, tail4=0, thighI=1, shinI=1, footI=1, thighF=2, shinF=2, footF=2,
                  pelvis=3, torso=3, iceU=4, iceL=4, head=5, fireU=6, fireF=6),
    'back': dict(tail1=0, tail2=0, tail3=0, tail4=0, thighF=1, shinF=1, footF=1, thighI=2, shinI=2, footI=2,
                 pelvis=3, torso=3, head=5, iceU=4, iceL=4, fireU=6, fireF=6),
}[side]
NAMES = list(RIG)
LEGS = [('thighF', 'shinF', 'footF'), ('thighI', 'shinI', 'footI')]
TAIL = ['tail1', 'tail2', 'tail3', 'tail4']

F = np.load(src)
H, W = F.shape[1:3]
V, U = np.mgrid[0:H, 0:W].astype(float)
V -= PAD


def seg_dist(a, b):
    a, b = np.array(a, float), np.array(b, float)
    d = b - a
    t = np.clip(((U - a[0]) * d[0] + (V - a[1]) * d[1]) / max(d @ d, 1e-9), 0, 1)
    return np.hypot(U - (a[0] + t * d[0]), V - (a[1] + t * d[1]))


# ---- weights: nearest bone inside its box, then one-hot maps diffused only through the creature's own pixels, so
# parts that a gap separates in the rest pose (an arm hanging beside the body) never blend and stretch the gap ----
dist = np.stack([seg_dist(RIG[n][1], RIG[n][2]) for n in NAMES])
inbox = np.stack([(U >= RIG[n][3][0]) & (U < RIG[n][3][2]) & (V >= RIG[n][3][1]) & (V < RIG[n][3][3]) for n in NAMES])
label = np.where(inbox, dist, dist + 1000).argmin(0)
Wt = np.stack([(label == i).astype(float) for i in range(len(NAMES))])
body = (F[..., 3] > 0).any(0)
for _ in range(10):
    s = Wt * body
    nsum = np.zeros_like(Wt); ncnt = np.zeros(body.shape)
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        nsum += np.roll(s, (dy, dx), (1, 2)); ncnt += np.roll(body, (dy, dx), (0, 1))
    Wt = np.where(body, (Wt + nsum) / (1 + ncnt), Wt)
# a pixel blends only between its own bone and that bone's parent and children: parts that merely touch (an arm against
# a thigh) slide past each other, and DEPTH decides which one is in front
kin = np.eye(len(NAMES), dtype=bool)
for i, n in enumerate(NAMES):
    if RIG[n][0] is not None:
        j = NAMES.index(RIG[n][0]); kin[i, j] = kin[j, i] = True
for leg in LEGS:   # a foot is fixed, not parented, but it joins its shin
    i, j = NAMES.index(leg[1]), NAMES.index(leg[2]); kin[i, j] = kin[j, i] = True
Wt = Wt * kin[:, label].astype(float)
Wt /= Wt.sum(0, keepdims=True)
ZOF = np.array([DEPTH[n] for n in NAMES])

if '--labels' in sys.argv:
    rng = np.random.default_rng(3)
    pal = rng.integers(60, 255, (len(NAMES), 3))
    f = F[0]
    img = (pal[label] * 0.55 + f[..., :3] * 0.45).astype(np.uint8)
    img[f[..., 3] == 0] = (pal[label][f[..., 3] == 0] * 0.15).astype(np.uint8)
    Image.fromarray(img).resize((W * 5, H * 5), Image.NEAREST).save(out + '-labels.png')
    sys.exit()


def rot(deg):
    r = np.radians(deg)
    return np.array([[np.cos(r), -np.sin(r)], [np.sin(r), np.cos(r)]])


def angle_between(a, b):
    return np.degrees(np.arctan2(a[0] * b[1] - a[1] * b[0], a @ b))


def pose(t, n_frames):
    """Bone transforms (R, rest pivot, world pivot) for frame t: the idle's motion lives here."""
    s = 2 * np.pi * t / n_frames      # one slow cycle per loop (sway)
    b = 2 * s                          # two breaths per loop
    down = 0.5 - 0.5 * np.cos(b)       # 0..1, deepest on each breath (and flare) peak
    rel = {
        'pelvis': 0.0,
        'torso': 2.8 * np.sin(s) + 1.2 * np.sin(b - 0.4),
        'head': -3.5 * np.sin(s - 0.7) + 2.5 * np.sin(b - 1.1),
        'fireU': 7.0 * np.sin(b - 0.5),
        'fireF': -11.0 * np.sin(b - 1.0),
        'iceU': 5.0 * np.sin(s + 1.2) + 2.5 * np.sin(b - 0.6),
        'iceL': 7.0 * np.sin(s + 0.5) + 3.0 * np.sin(b - 1.0),
    }
    for k, n in enumerate(TAIL):
        rel[n] = (4 + 2 * k) * np.sin(b - 0.8 * k - 0.4)
    root = np.array([1.6 * np.sin(s), 2.2 * down])   # sway and knee bend (y down)
    T = {}

    def place(n):
        if n in T:
            return T[n]
        parent, pivot, _, _ = RIG[n]
        pivot = np.array(pivot, float)
        if parent is None:
            R, P = rot(0), pivot + (root if n == 'pelvis' else 0)
        else:
            Rp, pp, Pp = place(parent)
            R = Rp @ rot(rel.get(n, 0.0))
            P = Rp @ (pivot - pp) + Pp
        T[n] = (R, pivot, P)
        return T[n]

    for n in NAMES:
        if n not in sum(LEGS, ()):
            place(n)
    for thigh, shin, foot in LEGS:   # two-bone IK: the hip moves with the pelvis, the ankle stays put
        hip, knee, ankle = (np.array(RIG[thigh][1], float), np.array(RIG[shin][1], float), np.array(RIG[shin][2], float))
        Rp, pp, Pp = T['pelvis']
        H2 = Rp @ (hip - pp) + Pp
        l1, l2 = np.linalg.norm(knee - hip), np.linalg.norm(ankle - knee)
        d = min(np.linalg.norm(ankle - H2), l1 + l2 - 1e-3)
        a = (l1 ** 2 - l2 ** 2 + d ** 2) / (2 * d)
        h = np.sqrt(max(l1 ** 2 - a ** 2, 0))
        e = (ankle - H2) / np.linalg.norm(ankle - H2)
        nrm = np.array([-e[1], e[0]])
        rest_side = np.sign((knee - hip)[0] * (ankle - hip)[1] - (knee - hip)[1] * (ankle - hip)[0]) or 1
        K2 = H2 + a * e - rest_side * h * nrm
        if np.sign((K2 - H2)[0] * (ankle - H2)[1] - (K2 - H2)[1] * (ankle - H2)[0]) != rest_side:
            K2 = H2 + a * e + rest_side * h * nrm
        T[thigh] = (rot(angle_between(knee - hip, K2 - H2)), hip, H2)
        T[shin] = (rot(angle_between(ankle - knee, ankle - K2)), knee, K2)
        T[foot] = (rot(0), np.array(RIG[foot][1], float), np.array(RIG[foot][1], float))
    return T


def epx(img):
    """Scale2x (EPX) on packed colours: smooth diagonals, no new colours."""
    p = np.pad(img, 1, mode='edge')
    E, B, D, Fr, Hh = p[1:-1, 1:-1], p[:-2, 1:-1], p[1:-1, :-2], p[1:-1, 2:], p[2:, 1:-1]
    o = np.empty((img.shape[0] * 2, img.shape[1] * 2), img.dtype)
    o[0::2, 0::2] = np.where((D == B) & (B != Fr) & (D != Hh), D, E)
    o[0::2, 1::2] = np.where((B == Fr) & (B != D) & (Fr != Hh), Fr, E)
    o[1::2, 0::2] = np.where((D == Hh) & (D != B) & (Hh != Fr), D, E)
    o[1::2, 1::2] = np.where((Hh == Fr) & (D != Hh) & (B != Fr), Fr, E)
    return o


def pack(f):
    f = f.astype(np.uint32)
    return (f[..., 0] << 24) | (f[..., 1] << 16) | (f[..., 2] << 8) | np.where(f[..., 3] > 0, 255, 0).astype(np.uint32)


def unpack(p):
    return np.stack([(p >> 24) & 255, (p >> 16) & 255, (p >> 8) & 255, p & 255], -1).astype(np.uint8)


def skin(T, P_u, P_v):
    """Forward map of rest points (u, v) under the blended bone transforms."""
    iu = np.clip(np.round(P_u), 0, W - 1).astype(int)
    iv = np.clip(np.round(P_v + PAD), 0, H - 1).astype(int)
    w = Wt[:, iv, iu]
    ou = np.zeros_like(P_u); ov = np.zeros_like(P_v)
    for i, n in enumerate(NAMES):
        R, p0, P = T[n]
        x, y = P_u - p0[0], P_v - p0[1]
        ou += w[i] * (R[0, 0] * x + R[0, 1] * y + P[0])
        ov += w[i] * (R[1, 0] * x + R[1, 1] * y + P[1])
    return ou, ov


def fill_cracks(p):
    """A transparent pixel between two opaque ones (left/right or up/down) is a crack where joints pull apart: it
    takes the colour of one of them. Two passes close 2 px cracks."""
    for _ in range(2):
        op = (p & 255) > 0
        out = p.copy()
        for (dy, dx) in ((0, 1), (1, 0)):
            a, b = np.roll(p, (dy, dx), (0, 1)), np.roll(p, (-dy, -dx), (0, 1))
            hole = ~op & ((a & 255) > 0) & ((b & 255) > 0) & ((out & 255) == 0)
            out[hole] = a[hole]
        p = out
    return p


SS = 8  # sub-pixels per pixel edge
frames = []
N = len(F)
for t in range(N):
    T = pose(t, N)
    big = epx(epx(epx(pack(F[t]))))    # 8x: stretched joints stay dense enough to cover every pixel
    sy, sx = np.nonzero(big & 255)     # opaque sub-pixels
    col = big[sy, sx]
    ou, ov = skin(T, (sx + 0.5) / SS, (sy + 0.5) / SS - PAD)
    iu, iv = np.floor(ou).astype(int), np.floor(ov + PAD).astype(int)
    ok = (iu >= 0) & (iu < W) & (iv >= 0) & (iv < H)
    cell = (iv[ok] * W + iu[ok]).astype(np.int64)
    z = ZOF[label[(sy[ok] // SS), (sx[ok] // SS)]].astype(np.int64)
    # per cell, the front-most part landing at least a quarter of a pixel there (else whichever lands most)
    zk, zc = np.unique(cell << 8 | z, return_counts=True)
    zcell, zz = zk >> 8, zk & 255
    score = np.where(zc >= SS * SS // 4, 1000 + zz, zc)
    o = np.lexsort((-score, zcell)); keep = np.r_[True, zcell[o][1:] != zcell[o][:-1]]
    zsel = np.zeros(H * W, np.int64) - 1
    zsel[zcell[o][keep]] = zz[o][keep]
    front = z == zsel[cell]
    cell_all = cell
    cell, colk = cell[front], col[ok][front]
    key = cell << 32 | colk.astype(np.int64)
    uk, cnt = np.unique(key, return_counts=True)
    kc, kcol = uk >> 32, (uk & 0xFFFFFFFF).astype(np.uint32)
    order = np.lexsort((-cnt, kc))     # per cell, the most frequent colour first
    kc, kcol, cnt = kc[order], kcol[order], cnt[order]
    first = np.r_[True, kc[1:] != kc[:-1]]
    cover = np.bincount(cell_all, minlength=H * W)
    fr = np.zeros(H * W, np.uint32)
    fr[kc[first]] = kcol[first]
    fr[cover < SS * SS * 3 // 8] = 0   # opaque when sub-pixels cover 3/8 of the pixel
    frames.append(unpack(fill_cracks(fr.reshape(H, W))))
A = np.stack(frames)
np.save(out + '.npy', A)
ims = [Image.fromarray(a).resize((W * 2, H * 2), Image.NEAREST) for a in A]
ims[0].save(out + '-256.gif', save_all=True, append_images=ims[1:], duration=100, loop=0, disposal=2)
print('frames', len(A))
