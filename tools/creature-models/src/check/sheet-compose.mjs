// node sheet-compose.mjs <dir> <out.jpg> [cols]: rows = clips (from filenames clip__k.jpg), labelled
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';
const [dir, outFile] = process.argv.slice(2);
const files = readdirSync(dir).filter((f) => f.endsWith('.jpg') && f.includes('__'));
const clips = [...new Set(files.map((f) => f.split('__')[0]))];
const order = ['idle', 'walk', 'windup', 'lunge', 'hurt', 'recoil', 'faint', 'celebrate', 'enter', 'exit'];
clips.sort((a, b) => (order.indexOf(a) + 100 * (order.indexOf(a) < 0)) - (order.indexOf(b) + 100 * (order.indexOf(b) < 0)) || a.localeCompare(b));
const T = 220; const L = 110;
const cols = Math.max(...clips.map((c) => files.filter((f) => f.startsWith(`${c}__`)).length));
const comps = [];
clips.forEach((c, r) => {
  comps.push({ input: { text: { text: `<span foreground="white" font="13">${c}</span>`, rgba: true, dpi: 110 } }, left: 6, top: r * T + 8 });
  for (let k = 0; k < cols; k++) comps.push({ input: join(dir, `${c}__${k}.jpg`), left: L + k * T, top: r * T, _resize: true });
});
const inputs = await Promise.all(comps.map(async (x) => (x._resize ? { ...x, input: await sharp(x.input).resize(T - 4, T - 4).toBuffer(), _resize: undefined } : x)));
await sharp({ create: { width: L + cols * T, height: clips.length * T, channels: 3, background: '#20242c' } })
  .composite(inputs.map(({ _resize, ...x }) => x)).jpeg({ quality: 85 }).toFile(outFile);
console.log(outFile);
