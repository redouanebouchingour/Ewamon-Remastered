// node tile.mjs <out.jpg> <size> <in…>: one row of tiles
import sharp from 'sharp';
const [out, size, ...ins] = process.argv.slice(2);
const S = Number(size);
const bufs = await Promise.all(ins.map((f) => sharp(f).resize(S, S).toBuffer()));
await sharp({ create: { width: S * bufs.length, height: S, channels: 3, background: '#000' } }).composite(bufs.map((b, i) => ({ input: b, left: i * S, top: 0 }))).jpeg({ quality: 85 }).toFile(out);
