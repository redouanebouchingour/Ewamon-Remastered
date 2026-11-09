"""Idle loops for the painted 1024² battle sprites (the Majin and Tenjin forms), on a 2D bone rig.

The same idea as rig_idle.py (Kelvyre), sized for 1024² sprites with chunky painted pixels and no AI layer:

- Bones per sprite and side live in form_rigs.py: segments in source pixels, a role, a draw depth and an optional box
  (the bone can only own pixels inside it) and radius (a thick bone: its distance is measured from its surface).
- The legs, feet or pedestal are one fixed `ground` bone; the `body` bone sways and bobs over it, so the hips squash a
  little instead of the feet sliding. Floaters have a `float` body and no ground.
- Weights are worked out at 1/4 scale: each pixel belongs to the nearest bone inside its box and blends with that
  bone's parent, children and siblings (and the ground with the body) by distance, over a ~80 px zone around the
  boundary between them; then scaled back up.
- Every opaque pixel is split into 4x4 sub-pixels and pushed through the skin; each output pixel takes the majority
  colour of the front-most part covering a quarter of it (`depth`) and is opaque when any sub-pixel lands there, so joints
  stretched up to 4x stay closed; hairline tears left in stretched areas are filled, but the still's own gaps (skinned
  along with the frame) stay open.
- Every motion is offset so frame 0 is the rest pose: page 0 is the still itself, so `frame-select.json` stays 0 and
  the static atlas does not change.

    python rig_forms.py <id> <front|back> <out.webp> [--frames 24] [--ms 125] [--labels <png>] [--preview <gif>]
"""
import argparse
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from form_rigs import RIGS  # noqa: E402

ap = argparse.ArgumentParser()
ap.add_argument('id'); ap.add_argument('side'); ap.add_argument('out')
ap.add_argument('--frames', type=int, default=24); ap.add_argument('--ms', type=int, default=125)
ap.add_argument('--src', default=None); ap.add_argument('--labels'); ap.add_argument('--preview')
args = ap.parse_args()

# the stills moved here when their animated WebP sources replaced them in assets-src/creatures/
src = args.src or f'assets-src/imagegen/forms-anim/stills/{args.side}/{args.id}({args.side}).png'
IMG = np.asarray(Image.open(src).convert('RGBA'))
H, W = IMG.shape[:2]
RIG = RIGS[args.id][args.side]
NAMES = list(RIG)
Q = 4  # weights are computed at 1/Q scale


def bone(n):
    b = RIG[n]
    return dict(parent=b.get('parent'), pivot=np.array(b['pivot'], float), end=np.array(b.get('end', b['pivot']), float),
                role=b['role'], depth=b.get('depth', 3), box=b.get('box'), r=b.get('r', 0), sign=b.get('sign', 1),
                phase=b.get('phase', 0.0), amp=b.get('amp', 1.0), idx=b.get('idx', 0))


B = {n: bone(n) for n in NAMES}
for n, b in B.items():
    if b['parent'] is None and b['role'] not in ('ground', 'body', 'float'):
        b['parent'] = next(m for m in NAMES if B[m]['role'] in ('body', 'float'))

# ---- weights ----
h, w = H // Q, W // Q
V, U = (np.mgrid[0:h, 0:w].astype(float) + 0.5) * Q


def seg_dist(a, b):
    d = b - a
    t = np.clip(((U - a[0]) * d[0] + (V - a[1]) * d[1]) / max(d @ d, 1e-9), 0, 1)
    return np.hypot(U - (a[0] + t * d[0]), V - (a[1] + t * d[1]))


dist = np.stack([np.maximum(seg_dist(B[n]['pivot'], B[n]['end']) - B[n]['r'], 0) for n in NAMES])
inbox = np.stack([np.ones((h, w), bool) if B[n]['box'] is None else
                  (U >= B[n]['box'][0]) & (U < B[n]['box'][2]) & (V >= B[n]['box'][1]) & (V < B[n]['box'][3]) for n in NAMES])
label_s = np.where(inbox, dist, dist + 1e6).argmin(0)
kin = np.eye(len(NAMES), dtype=bool)
for i, n in enumerate(NAMES):
    p = B[n]['parent']
    if p is not None:
        j = NAMES.index(p); kin[i, j] = kin[j, i] = True
for i, n in enumerate(NAMES):   # siblings that touch (two arms at one shoulder, upper and lower wing) blend, not tear
    for j, m in enumerate(NAMES):
        if B[n]['parent'] is not None and B[n]['parent'] == B[m]['parent']:
            kin[i, j] = True
for g in (i for i, n in enumerate(NAMES) if B[n]['role'] == 'ground'):   # the hips blend: they squash, not tear
    for j in (i2 for i2, n in enumerate(NAMES) if B[n]['role'] == 'body'):
        kin[g, j] = kin[j, g] = True
# Each pixel blends its own bone with the related bones by distance: full weight on the boundary between them, falling
# off over SIGMA px. Blend zones ~2 SIGMA wide keep a joint's stretch gentle (relative movement / zone width); flat
# sprites have nothing painted behind a part, so touching parts must blend rather than slide apart.
SIGMA = 40.0
dmin = np.take_along_axis(dist, label_s[None], 0)[0]
Wt = np.exp(-((dist - dmin) / SIGMA) ** 2).astype(np.float32)
Wt *= kin[:, label_s]   # boxes decide ownership only: cutting a weight at a box edge would crack the sprite there
# smooth what is left: any jump in a weight (where two owners allow different bones) is a crack once the parts move
Wt = np.stack([ndimage.gaussian_filter(w, 4.0) for w in Wt])
Wt /= Wt.sum(0, keepdims=True)
# back to full size: nearest for the label (depth), bilinear for the weights
label = np.repeat(np.repeat(label_s, Q, 0), Q, 1)
Wt = np.stack([ndimage.zoom(Wt[i], Q, order=1) for i in range(len(NAMES))]).astype(np.float32)
Wt /= np.maximum(Wt.sum(0, keepdims=True), 1e-6)
# unique per bone (its depth, then rig order: a child over its parent), so two bones that fold over each other never
# interleave their pixels
ZOF = np.array([B[n]['depth'] * 32 + i for i, n in enumerate(NAMES)])

if args.labels:
    rng = np.random.default_rng(5)
    pal = rng.integers(70, 255, (len(NAMES), 3))
    img = (pal[label] * 0.6 + IMG[..., :3] * 0.4).astype(np.uint8)
    img[IMG[..., 3] == 0] = (pal[label][IMG[..., 3] == 0] * 0.12).astype(np.uint8)
    from PIL import ImageDraw
    im = Image.fromarray(img).resize((512, 512))
    d = ImageDraw.Draw(im)
    for i, n in enumerate(NAMES):
        a, e = B[n]['pivot'] / 2, B[n]['end'] / 2
        d.line([tuple(a), tuple(e)], fill=(255, 255, 255), width=2)
        d.text(tuple(a + 3), n, fill=(255, 255, 255))
    im.save(args.labels)
    sys.exit()


# ---- motion ----
def rot(deg):
    r = math.radians(deg)
    return np.array([[math.cos(r), -math.sin(r)], [math.sin(r), math.cos(r)]])


def angles(t, n_frames):
    s = 2 * math.pi * t / n_frames
    out, move = {}, (0.0, 0.0)
    for n in NAMES:
        b = B[n]; a, ph, role = b['amp'], b['phase'], b['role']
        if role == 'body':
            out[n] = 2.5 * a * math.sin(s - 0.3 + ph)
            move = (6 * a * math.sin(s + ph), 10 * a * (0.5 - 0.5 * math.cos(2 * s)))
        elif role == 'float':
            out[n] = 2.0 * a * math.sin(s - 0.5 + ph)
            move = (8 * a * math.sin(s + 1.0 + ph), -16 * a * math.sin(s + ph))
        elif role == 'head':
            out[n] = a * (3.5 * math.sin(s - 1.0 + ph) + 1.5 * math.sin(2 * s - 1.2 + ph))
        elif role == 'arm':
            out[n] = a * (5.0 * math.sin(s - 0.6 + ph) + 2.0 * math.sin(2 * s - 1.0 + ph))
        elif role == 'wing':
            out[n] = b['sign'] * a * 9.0 * math.sin(2 * s - 0.4 + ph)
        elif role == 'fin':
            out[n] = b['sign'] * a * 7.0 * math.sin(2 * s - 0.4 - 0.6 * b['idx'] + ph)
        elif role == 'tail':
            out[n] = a * (4 + 2 * b['idx']) * math.sin(s - 0.8 * b['idx'] - 0.4 + ph)
        elif role == 'antenna':
            out[n] = a * 6.0 * math.sin(s - 1.4 + ph)
        elif role == 'cape':
            out[n] = a * 3.5 * math.sin(s - 1.0 + ph)
        else:  # ground
            out[n] = 0.0
    return out, move


def pose(t, n_frames):
    """Bone transforms for frame t, minus frame 0's, so frame 0 is the rest pose."""
    a, mv = angles(t, n_frames)
    a0, mv0 = angles(0, n_frames)
    rel = {n: a[n] - a0[n] for n in NAMES}
    move = np.array(mv) - np.array(mv0)
    T = {}

    def place(n):
        if n in T:
            return T[n]
        b = B[n]
        if b['parent'] is None:
            R = rot(rel[n]); P = b['pivot'] + (move if b['role'] in ('body', 'float') else 0)
        else:
            Rp, pp, Pp = place(b['parent'])
            R = Rp @ rot(rel[n]); P = Rp @ (b['pivot'] - pp) + Pp
        T[n] = (R, b['pivot'], P)
        return T[n]

    for n in NAMES:
        place(n)
    return T


def pack(f):
    f = f.astype(np.uint32)
    return (f[..., 0] << 24) | (f[..., 1] << 16) | (f[..., 2] << 8) | f[..., 3]


def unpack(p):
    return np.stack([(p >> 24) & 255, (p >> 16) & 255, (p >> 8) & 255, p & 255], -1).astype(np.uint8)


def fill_holes(p, protect):
    """Two passes: a transparent, unprotected pixel with at least 5 of its 8 neighbours opaque takes the most common
    neighbour colour."""
    for _ in range(2):
        op = (p & 255) > 0
        nb = [np.roll(p, (dy, dx), (0, 1)) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
        cnt = sum(((q & 255) > 0).astype(np.int32) for q in nb)
        hole = ~op & ~protect & (cnt >= 5)
        if not hole.any():
            break
        cand = np.stack([q[hole] for q in nb])            # 8 x holes
        best = cand[0].copy(); bestn = np.zeros(len(best), np.int32)
        for q in cand:
            n = ((cand == q) & ((cand & 255) > 0)).sum(0)
            better = ((q & 255) > 0) & (n > bestn)
            best[better] = q[better]; bestn[better] = n[better]
        p = p.copy(); p[hole] = best
    return p


# the still's own enclosed gaps (between fingers, inside a halo): their centres are skinned with the frame, and the
# hole fill leaves them open
_op = IMG[..., 3] > 0
_k = np.ones((3, 3)); _k[1, 1] = 0
gy_, gx_ = np.nonzero(~_op & (ndimage.convolve(_op.astype(int), _k, mode='constant') >= 5))
gx, gy = gx_ + 0.5, gy_ + 0.5
gw = Wt[:, gy_, gx_]

SS = 4  # sub-pixels per pixel edge: stretched joints stay densely covered (2 left moire stripes)
P = pack(IMG)
oy, ox = np.nonzero(IMG[..., 3] > 0)
sub = [(oy + (j + 0.5) / SS, ox + (i + 0.5) / SS) for j in range(SS) for i in range(SS)]
sy = np.concatenate([s[0] for s in sub]); sx = np.concatenate([s[1] for s in sub])
col = np.tile(P[oy, ox], SS * SS)
zsub = np.tile(ZOF[label[oy, ox]], SS * SS).astype(np.int64)
wsub = np.concatenate([Wt[:, oy, ox]] * (SS * SS), axis=1)  # bones x sub-pixels
frames = []
for t in range(args.frames):
    T = pose(t, args.frames)
    ou = np.zeros_like(sx); ov = np.zeros_like(sy)
    for i, n in enumerate(NAMES):
        R, p0, Pn = T[n]
        x, y = sx - p0[0], sy - p0[1]
        ou += wsub[i] * (R[0, 0] * x + R[0, 1] * y + Pn[0])
        ov += wsub[i] * (R[1, 0] * x + R[1, 1] * y + Pn[1])
    iu, iv = np.floor(ou).astype(np.int64), np.floor(ov).astype(np.int64)
    ok = (iu >= 0) & (iu < W) & (iv >= 0) & (iv < H)
    cell = iv[ok] * W + iu[ok]; z = zsub[ok]; c = col[ok]
    zk, zc = np.unique(cell << 8 | z, return_counts=True)
    zcell, zz = zk >> 8, zk & 255
    score = np.where(zc >= SS * SS // 4, 1000 + zz, zc)   # a layer must cover a quarter pixel to be in front
    o = np.lexsort((-score, zcell)); keep = np.r_[True, zcell[o][1:] != zcell[o][:-1]]
    zsel = np.full(H * W, -1, np.int64); zsel[zcell[o][keep]] = zz[o][keep]
    front = z == zsel[cell]
    key = cell[front] << 32 | c[front].astype(np.int64)
    uk, cnt = np.unique(key, return_counts=True)
    kc, kcol = uk >> 32, (uk & 0xFFFFFFFF).astype(np.uint32)
    o = np.lexsort((-cnt, kc)); kc, kcol = kc[o], kcol[o]
    first = np.r_[True, kc[1:] != kc[:-1]]
    cover = np.bincount(cell, minlength=H * W)
    fr = np.zeros(H * W, np.uint32); fr[kc[first]] = kcol[first]
    # where the still's own gaps went this frame (protected), then fill every other enclosed hole: a hairline tear
    hu = np.floor(np.sum([gw[i] * (T[n][0][0, 0] * (gx - T[n][1][0]) + T[n][0][0, 1] * (gy - T[n][1][1]) + T[n][2][0]) for i, n in enumerate(NAMES)], 0)).astype(np.int64)
    hv = np.floor(np.sum([gw[i] * (T[n][0][1, 0] * (gx - T[n][1][0]) + T[n][0][1, 1] * (gy - T[n][1][1]) + T[n][2][1]) for i, n in enumerate(NAMES)], 0)).astype(np.int64)
    keep_h = (hu >= 0) & (hu < W) & (hv >= 0) & (hv < H)
    protect = np.zeros(H * W, bool); protect[hv[keep_h] * W + hu[keep_h]] = True
    frames.append(unpack(fill_holes(fr.reshape(H, W), protect.reshape(H, W))))

assert (frames[0] == IMG).all(), 'frame 0 must be the still'
ims = [Image.fromarray(f) for f in frames]
ims[0].save(args.out, save_all=True, append_images=ims[1:], duration=args.ms, loop=0, lossless=True, method=4)
if args.preview:
    sm = [Image.alpha_composite(Image.new('RGBA', (W, H), (40, 44, 60, 255)), f).resize((256, 256)).convert('RGB') for f in ims]
    sm[0].save(args.preview, save_all=True, append_images=sm[1:], duration=args.ms, loop=0)
a = np.stack([f[..., 3] > 0 for f in frames]).reshape(len(frames), -1).astype(np.float32)
D = (a @ (1 - a).T); D = D + D.T
i, j = np.unravel_index(D.argmax(), D.shape)
print(f'{args.id}/{args.side}: {len(frames)} frames, silhouette change {100 * D[i, j] / max(((a[i] + a[j]) > 0).sum(), 1):.0f}%')
