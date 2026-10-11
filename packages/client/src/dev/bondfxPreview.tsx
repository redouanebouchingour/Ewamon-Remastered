/**
 * Dev-only preview of the Majin / Tenjin bond cinematic (`/bondfx/`, not a build input) over the signature preview's
 * mock arena, with the battle-form burst's target standing where the arena puts it.
 *
 *   /bondfx/?species=toxshade          plays on a loop (the band is its battle form's kind: majin / tenjin)
 *   &side=far                          the far (foe's) battler transforms   &reduced=1   reduced motion
 *   &trainer=Reeve                     the name on the band (default: Red)
 *   &t=2400                            frozen at 2400 ms of the cue's clock (CDP: window.__bondfx.seek(ms))
 */
import '../ui/fonts.css';
import '../ui/tokens.css';
import '../ui/global.css';
import { createRoot } from 'react-dom/client';
import { BOND_TOTAL_MS, useBondStore } from '../battle/bond';
import { BondCinematic } from '../battle/BondCinematic';
import { species } from '../data/content';
import { cssVars } from '../ui/cssVars';
import s from './sigfxPreview.module.css';

const q = new URLSearchParams(location.search);
const speciesId = q.get('species') ?? 'toxshade';
const sp = species(speciesId);
const form = sp?.battleForm?.id ?? 'majin';
const kind = sp?.battleForm?.kind ?? 'majin';
const near = q.get('side') !== 'far';
const reduced = q.get('reduced') === '1';
const trainer = q.get('trainer') ?? 'Red';
const foe = q.get('foe') ?? 'gemknight';
const frozen = q.get('t');

function Battler({ id, x, y, h }: { id: string; x: number; y: number; h: number }) {
  return (
    <>
      <div className={s.pad} style={cssVars({ '--x': `${x}vw`, '--y': `${y}vh`, '--h': `${h}vh` })} />
      <img className={s.mon} style={cssVars({ '--x': `${x}vw`, '--y': `${y}vh`, '--h': `${h}vh` })} src={`/creatures/thumbs/${id}_front.webp`} alt="" />
    </>
  );
}

function Preview() {
  const [nearId, farId] = near ? [speciesId, foe] : [foe, speciesId];
  return (
    <>
      <div className={s.arena}>
        <Battler id={farId} x={72} y={36} h={28} />
        <Battler id={nearId} x={28} y={64} h={42} />
      </div>
      <BondCinematic />
      <p className={s.label}>{`${speciesId} · ${kind} (${form}) · ${near ? 'near' : 'far'}${reduced ? ' · reduced' : ''}`}</p>
    </>
  );
}

let id = 0;
function show(): void {
  useBondStore.getState().show({ id: ++id, kind, speciesId, form, name: sp?.name ?? speciesId, trainer, near, reduced });
}

/** Freezes every animation of the cue at `ms` of its clock. */
async function seek(ms: number): Promise<void> {
  show();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const root = document.querySelector('[data-testid=bondcinematic]');
  for (const a of root?.getAnimations({ subtree: true }) ?? []) {
    a.pause();
    a.currentTime = ms;
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

const el = document.createElement('div');
document.body.appendChild(el);
createRoot(el).render(<Preview />);
(window as unknown as { __bondfx: unknown }).__bondfx = { seek, show };
if (frozen !== null) void seek(Number(frozen));
else {
  show();
  setInterval(show, BOND_TOTAL_MS + 900);
}
