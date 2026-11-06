"""Write the composed frames as lossless animated WebP sources (100 ms) and print the page closest to the still."""
import sys, numpy as np
from PIL import Image
K = sys.argv[1]
for side, n in [('front', 'vf'), ('back', 'vb')]:
    A = np.load(f'{K}/{n}.npy')
    o = np.zeros(A.shape[1:], np.uint8)
    o[32:] = np.asarray(Image.open(f'assets-src/imagegen/kelvyre-anim/stills/kelvyre({side}).png').convert('RGBA'))
    d = [((np.abs(f[..., :3].astype(int) - o[..., :3]).sum(-1) > 24) | ((f[..., 3] > 0) != (o[..., 3] > 0))).sum() for f in A]
    print(side, 'static page', int(np.argmin(d)))
    ims = [Image.fromarray(a) for a in A]
    ims[0].save(f'assets-src/creatures/{side}/kelvyre({side}).webp', save_all=True, append_images=ims[1:], duration=100, loop=0, lossless=True, method=6)
