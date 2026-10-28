// Stills of one creature from four headings (CDP steps for scripts/cdp.mjs), for checking assign() with RIG_PARTS=1:
//   SPECIES=<id> OUT=<file prefix> [HEADINGS=0,0.9,1.57,3.14] [CLIP=idle] [T=0] [DIST=5] [W=600] [CY=0.6] [PORT=5191]
// writes <OUT>_<k>.jpg; tile.mjs puts them in a row.
import { writeFileSync } from 'node:fs';
export default async ({ ev, sleep, nav, send }) => {
  const id = process.env.SPECIES;
  await nav(`http://localhost:${process.env.PORT ?? 5191}/?demo=rig&species=${id}&glide=0&dist=${process.env.DIST ?? 5}`);
  for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('return !!(window.__ewaSandbox?.part3?.rig?.ready?.())')) break; }
  await ev(`document.querySelectorAll('button').forEach(b => b.parentElement.style.display = 'none'); return 1`);
  const out = [];
  const W = Number(process.env.W ?? 600);
  const clip = { x: 720 - W / 2, y: 450 - W * Number(process.env.CY ?? 0.6), width: W, height: W, scale: 1 };
  for (const [k, h] of (process.env.HEADINGS ?? '0,0.9,1.57,3.14').split(',').map(Number).entries()) {
    await ev(`const r = window.__ewaSandbox.part3.rig; r.hero.setHeading(${h}); r.scrub(${JSON.stringify(process.env.CLIP ?? 'idle')}, ${process.env.T ?? 0}); return 1`);
    await sleep(500);
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip });
    const f = `${process.env.OUT}_${k}.jpg`;
    writeFileSync(f, Buffer.from(r.result.data, 'base64'));
    out.push(f);
  }
  return out;
};
