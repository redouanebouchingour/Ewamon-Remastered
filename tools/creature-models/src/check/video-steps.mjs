// A frame-by-frame showcase (CDP steps for scripts/cdp.mjs): per creature the idle loop, two walk cycles, its fidgets,
// then the battle clips at half speed with a caption, each frame scrubbed at an exact 1/30 s step (real-time capture
// stutters on this machine). Then: ffmpeg -framerate 30 -i <FRAMES>/f%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 20 out.mp4
//   SPECIES=a,b,c FRAMES=<dir> [SETTLE=180 ms] [PORT=5191] and per creature JSON maps DISTS / HEADS / CYS ({"id": n})
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
export default async ({ ev, sleep, nav, send }) => {
  const out = process.env.FRAMES; mkdirSync(out, { recursive: true });
  const dist = JSON.parse(process.env.DISTS ?? '{}');
  const head = JSON.parse(process.env.HEADS ?? '{}');
  const cy = JSON.parse(process.env.CYS ?? '{}');
  const W = 720; const settle = Number(process.env.SETTLE ?? 180);
  let n = 0;
  const BATTLE = ['windup', 'lunge', 'hurt', 'recoil', 'faint', 'celebrate', 'enter', 'exit'];
  const SECS = { windup: 0.25, lunge: 0.3, hurt: 0.26, recoil: 0.25, faint: 0.9, celebrate: 0.6, enter: 0.45, exit: 0.35 };
  for (const id of process.env.SPECIES.split(',')) {
    await nav(`http://localhost:${process.env.PORT ?? 5191}/?demo=rig&species=${id}&glide=0&dist=${dist[id] ?? 7}`);
    for (let i = 0; i < 120; i++) { await sleep(500); if (await ev('return !!(window.__ewaSandbox?.part3?.rig?.ready?.())')) break; }
    await ev(`document.querySelectorAll('button').forEach(b => b.parentElement.style.display = 'none');
      const c = document.createElement('div'); c.id = 'cap'; c.style.cssText = 'position:fixed;left:0;right:0;top:${450 - W * (cy[id] ?? 0.45) + 14}px;text-align:center;font:700 26px system-ui;color:#fff;text-shadow:0 2px 6px #000;z-index:99';
      document.body.append(c); window.__ewaSandbox.part3.rig.hero.setHeading(${head[id] ?? 0}); return 1`);
    const clips = await ev('return window.__ewaSandbox.part3.rig.clips()');
    const durs = await ev('return Object.fromEntries(window.__ewaSandbox.part3.rig.hero.rigPlayer.actions ? [...window.__ewaSandbox.part3.rig.hero.rigPlayer.actions].map(([k, a]) => [k, a.getClip().duration]) : [])');
    const name = id[0].toUpperCase() + id.slice(1);
    const plan = [['idle', durs.idle ?? 4, 1, 1], ['walk', durs.walk ?? 0.8, 2, 1],
      ...clips.filter((c) => c.startsWith('idle_')).map((c) => [c, durs[c] ?? 2, 1, 1]),
      ...BATTLE.filter((c) => clips.includes(c)).map((c) => [c, SECS[c], 1, 0.5])];
    const clip = { x: 720 - W / 2, y: 450 - W * (cy[id] ?? 0.45), width: W, height: W, scale: 1 };
    for (const [c, secs, loops, speed] of plan) {
      await ev(`document.getElementById('cap').textContent = ${JSON.stringify(`${name} · ${c}${speed < 1 ? ' (half speed)' : ''}`)}; return 1`);
      const frames = Math.round((secs * loops * 30) / speed);
      for (let f = 0; f <= frames; f++) {
        const u = ((f / frames) * loops) % 1 || (f === frames ? 1 : 0);
        await ev(`window.__ewaSandbox.part3.rig.scrub(${JSON.stringify(c)}, ${u}); return 1`);
        await sleep(settle);
        const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip });
        writeFileSync(join(out, `f${String(n++).padStart(5, '0')}.jpg`), Buffer.from(r.result.data, 'base64'));
      }
      // battle clips hold their last frame a moment
      if (speed < 1) for (let k = 0; k < 8; k++) { const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 90, clip }); writeFileSync(join(out, `f${String(n++).padStart(5, '0')}.jpg`), Buffer.from(r.result.data, 'base64')); }
    }
  }
  return { frames: n };
};
