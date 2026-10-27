// Trainer portraits for the profile's character picker: one knees-up shot per content BODIES row, rendered by the real
// actor code in the render sandbox's people demo, cropped to 256 px WebP under packages/client/public/trainers/.
// 1. pnpm --filter @ewa/render sandbox
// 2. chrome.exe --headless=new --remote-debugging-port=9446 --enable-unsafe-webgpu --enable-gpu --ignore-gpu-blocklist
//      --window-size=1440,900 --user-data-dir=<scratch dir> "http://localhost:5180/?demo=people&walkers=0&t=11"
// 3. node scripts/cdp.mjs scripts/trainer-portraits.mjs --shots <scratch dir>
// Re-run after a BODIES row or a character model changes.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
// sharp lives in the tools workspace, not at the root
const sharp = createRequire(resolve(root, 'tools/model-pipeline/package.json'))('sharp');
const out = resolve(root, 'packages/client/public/trainers');

export default async ({ ev, shot, sleep }) => {
  for (let i = 0; i < 60 && !(await ev('return !!window.__ewaSandbox?.part3?.people')); i++) await sleep(1000);
  // the render look id of every body (World3D `lookOf`): `<look>` or `<look>:<palette>`
  const bodies = await ev(`
    const { BODIES } = await import('/@fs/${root.replaceAll('\\', '/')}/packages/content/src/data/bodies.ts');
    return BODIES.map((b) => [b.id, b.palette ? b.look + ':' + b.palette : b.look]);`);
  if (!Array.isArray(bodies)) throw new Error(`BODIES did not load: ${JSON.stringify(bodies)}`);
  await ev(`
    for (const el of document.body.children) if (el.tagName !== 'CANVAS') el.style.display = 'none';
    const P = window.__ewaSandbox.part3; const p = P.bundle; const ppl = P.people; const T = P.three;
    p.hud.set({ zoneName: null, nameplates: [], chat: [], prompt: null, questHint: null, party: [] });
    const fwd = p.rig.dioramaForward(new T.Vector3()); const right = new T.Vector3(-fwd.z, 0, fwd.x);
    const faceCam = Math.atan2(-fwd.x, -fwd.z);
    ppl.wide(0);
    const first = p.actors.feetOf(ppl.ids[0], new T.Vector3()).clone();
    // a clear patch of grass 8 m right and 5 m back of the lineup; everyone else steps far away
    const x = first.x + right.x * 8 + fwd.x * 5, z = first.z + right.z * 8 + fwd.z * 5;
    window.__portrait = (look) => {
      ppl.ids.forEach((id, k) => p.actors.setTransform(id, 300 + k * 3, 300, 0, false, false));
      const id = 'look:' + look;
      p.actors.setTransform(id, x, z, faceCam, false, false);
      p.rig.inspect(p.actors.feetOf(id, new T.Vector3()).add(new T.Vector3(0, 0.8, 0)), 10, 5.4);
    };
    return 1;`);
  mkdirSync(out, { recursive: true });
  for (const [id, look] of bodies) {
    await ev(`window.__portrait(${JSON.stringify(look)}); return 1`);
    await sleep(1600);
    const raw = await shot(`raw_${id}`);
    await sharp(raw).extract({ left: 420, top: 60, width: 600, height: 600 }).resize(256, 256).webp({ quality: 82 }).toFile(resolve(out, `${id}.webp`));
  }
  return bodies.map(([id]) => id);
};
