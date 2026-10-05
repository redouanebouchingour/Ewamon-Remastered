/**
 * Dev measurement (not part of the build; run from tools/model-pipeline: `npx tsx dev/swatches.ts Knight Mage …`, or a
 * .gltf path): per KayKit texture, every swatch cell's top / bottom colour and splits; per mesh part, the cells its UVs
 * sample with vertex count, centroid, the UV range inside the cell and the smallest distance to a cell edge (IMPLEMENTATION-NOTES K2, K4, K5).
 */
import sharp from 'sharp';
import { NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
const K = '../../assets-src/models/kaykit-adventurers/Characters/gltf/';
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
for (const name of process.argv.slice(2)) {
  const doc = await io.read(name.includes('/') ? name : K + name + '.glb');
  const tex = doc.getRoot().listTextures()[0]!;
  const img = await sharp(tex.getImage()!).raw().ensureAlpha().toBuffer({ resolveWithObject: true });
  const W = img.info.width, H = img.info.height, px = img.data;
  const at = (x: number, y: number) => { const i = (Math.min(H - 1, Math.max(0, y)) * W + Math.min(W - 1, Math.max(0, x))) * 4; return [px[i]!, px[i + 1]!, px[i + 2]!]; };
  console.log('=====', name, W, H);
  // cell structure: split rows in center column
  for (let row = 0; row < 4; row++) {
    const line: string[] = [];
    for (let col = 0; col < 8; col++) {
      const cx = col * 128 + 64;
      const splits: number[] = [];
      for (let y = row * 256 + 1; y < row * 256 + 256; y++) {
        const a = at(cx, y - 1), b = at(cx, y);
        if (Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!) > 24) splits.push(y - row * 256);
      }
      // horizontal uniformity
      let maxdx = 0;
      for (let y = row * 256 + 8; y < row * 256 + 256; y += 16) { const a = at(col * 128 + 2, y), b = at(col * 128 + 125, y); maxdx = Math.max(maxdx, Math.abs(a[0]! - b[0]!) + Math.abs(a[1]! - b[1]!) + Math.abs(a[2]! - b[2]!)); }
      line.push(`${col},${row}:${hex(...(at(cx, row * 256 + 20) as [number, number, number]))}>${hex(...(at(cx, row * 256 + 235) as [number, number, number]))}${splits.length ? ' split@' + splits.join('/') : ''}${maxdx > 12 ? ' HDIFF' + maxdx : ''}`);
    }
    console.log(line.join('  '));
  }
  // per part usage
  for (const node of doc.getRoot().listNodes()) {
    const mesh = node.getMesh(); if (!mesh) continue;
    const usage = new Map<string, { n: number; x: number; y: number; z: number; umin: number; umax: number; vmin: number; vmax: number; edge: number }>();
    for (const p of mesh.listPrimitives()) {
      const P = p.getAttribute('POSITION')!, T = p.getAttribute('TEXCOORD_0')!;
      const e: number[] = [], t: number[] = [];
      for (let i = 0; i < P.getCount(); i++) {
        P.getElement(i, e); T.getElement(i, t);
        const u = t[0]!, v = t[1]!;
        const col = Math.floor(u * 8), row = Math.floor(v * 4);
        const key = `${col},${row}`;
        const r = usage.get(key) ?? { n: 0, x: 0, y: 0, z: 0, umin: 9, umax: -9, vmin: 9, vmax: -9, edge: 9 };
        r.n++; r.x += e[0]!; r.y += e[1]!; r.z += e[2]!;
        r.umin = Math.min(r.umin, u); r.umax = Math.max(r.umax, u); r.vmin = Math.min(r.vmin, v); r.vmax = Math.max(r.vmax, v);
        const fu = u * 8 - col; r.edge = Math.min(r.edge, fu, 1 - fu);
        usage.set(key, r);
      }
    }
    const parts = [...usage.entries()].sort((a, b) => b[1].n - a[1].n).map(([k, r]) => {
      const c = at(Math.round(((r.umin + r.umax) / 2) * W), Math.round(((r.vmin + r.vmax) / 2) * H));
      return `${k}[${r.n}] y${(r.y / r.n).toFixed(2)} z${(r.z / r.n).toFixed(2)} v${(r.vmin * 4 % 1).toFixed(2)}-${(r.vmax * 4 - Math.floor(r.vmin * 4)).toFixed(2)} e${r.edge.toFixed(2)} ${hex(c[0]!, c[1]!, c[2]!)}`;
    });
    console.log(' ', node.getName(), '\n    ' + parts.join('\n    '));
  }
}
