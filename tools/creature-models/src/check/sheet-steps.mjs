// Contact-sheet frames for one rigged creature (CDP steps for scripts/cdp.mjs; ANIMATING.md "Checking the result"):
// every clip scrubbed at TS and captured to <SHEETS>/<id>/<clip>__<k>.jpg; then sheet-compose.mjs tiles them.
//   SPECIES=<id> SHEETS=<dir> [CLIPS=a,b] [TS=0,0.2,0.4,0.6,0.8,1] [PORT=5191 the sandbox] [DIST=4 camera m]
//   [W=520 crop px] [CY=0.62 crop top, share of W above the centre] [HEADING=rad] [SETTLE=380 ms per frame]
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ ev, sleep, nav, send }) => {
  const id = process.env.SPECIES;
  const out = process.env.OUT ?? join(process.env.SHEETS ?? '.', id);
  mkdirSync(out, { recursive: true });
  const ts = (process.env.TS ?? '0,0.2,0.4,0.6,0.8,1').split(',').map(Number);
  await nav(`http://localhost:${process.env.PORT ?? 5191}/?demo=rig&species=${id}&glide=0&dist=${process.env.DIST ?? 4}${process.env.Q ?? ''}`);
  for (let i = 0; i < 120; i++) { await sleep(500); const ok = await ev('return !!(window.__ewaSandbox?.part3?.rig?.ready?.())'); if (ok) break; }
  await ev(`document.querySelectorAll('button').forEach(b => b.parentElement.style.display = 'none'); return 1`);
  if (process.env.HEADING) await ev(`window.__ewaSandbox.part3.rig.hero.setHeading(${Number(process.env.HEADING)}); return 1`);
  const clips = process.env.CLIPS ? process.env.CLIPS.split(',') : await ev('return window.__ewaSandbox.part3.rig.clips()');
  const W = Number(process.env.W ?? 520);
  const clip = { x: 720 - W / 2, y: 450 - W * Number(process.env.CY ?? 0.62), width: W, height: W, scale: 1 };
  const frames = [];
  for (const c of clips) for (const [k, t] of ts.entries()) {
    await ev(`window.__ewaSandbox.part3.rig.scrub(${JSON.stringify(c)}, ${t}); return 1`);
    await sleep(Number(process.env.SETTLE ?? 380));
    const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88, clip });
    const f = join(out, `${c}__${k}.jpg`);
    writeFileSync(f, Buffer.from(r.result.data, 'base64'));
    frames.push(f);
  }
  return { clips, n: frames.length, out };
};
