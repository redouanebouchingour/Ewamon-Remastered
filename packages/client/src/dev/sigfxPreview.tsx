/**
 * Dev-only preview of the signature move cinematics (`/sigfx/`, not a build input): one cinematic over a mock arena,
 * the battlers standing where the overlay's fallback layout aims (near 28 % / 64 %, far 72 % / 36 % of the viewport).
 *
 *   /sigfx/?move=Kamehameha            plays on a loop        &mode=short   the short cue (no band)
 *   &side=far                          the far battler attacks &reduced=1   reduced motion
 *   &t=1500                            frozen at 1500 ms of the cue's clock (CDP: window.__sigfx.seek(ms))
 */
import '../ui/fonts.css';
import '../ui/tokens.css';
import '../ui/global.css';
import { createRoot } from 'react-dom/client';
import { useCinematicStore } from '../battle/cinematic';
import { SignatureCinematic } from '../battle/SignatureCinematic';
import { SIGNATURE_CINEMATICS, signatureOf, skipMs } from '../battle/signatures';
import { cssVars } from '../ui/cssVars';
import s from './sigfxPreview.module.css';

const q = new URLSearchParams(location.search);
const asked = q.get('move') ?? 'Hollow Crescent';
const move = signatureOf(asked) !== undefined ? asked : 'Hollow Crescent';
const sig = signatureOf(move)!;
const mode = q.get('mode') === 'short' ? 'short' : 'full';
const fromNear = q.get('side') !== 'far';
const reduced = q.get('reduced') === '1';
const foe = q.get('foe') ?? 'castlemaw';
const frozen = q.get('t');

function Battler({ id, x, y, h }: { id: string; x: number; y: number; h: number }) {
  return (
    <>
      <div className={s.pad} style={cssVars({ '--x': `${x}vw`, '--y': `${y}vh`, '--h': `${h}vh` })} />
      <img className={s.mon} style={cssVars({ '--x': `${x}vw`, '--y': `${y}vh`, '--h': `${h}vh` })} src={`/signature/${id}.webp`} alt="" onError={(e) => e.currentTarget.setAttribute('src', `/creatures/thumbs/${id}_front.webp`)} />
    </>
  );
}

function Preview() {
  // the attacker's portrait stands in for its back sprite; the target is `foe`
  const [near, far] = fromNear ? [sig.portrait, foe] : [foe, sig.portrait];
  return (
    <>
      <div className={s.arena}>
        <Battler id={far} x={72} y={36} h={28} />
        <Battler id={near} x={28} y={64} h={42} />
      </div>
      <SignatureCinematic />
      <p className={s.label}>{`${move} · ${mode}${reduced ? ' · reduced' : ''} · ${fromNear ? 'near attacks' : 'far attacks'}`}</p>
    </>
  );
}

let id = 0;
function show(): void {
  useCinematicStore.getState().show({ id: ++id, move, mode, fromNear, from: null, to: null, reduced });
}

/** Freezes every animation of the cue at `ms` of its clock (a short cue's clock starts at 0 too). */
async function seek(ms: number): Promise<void> {
  show();
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const root = document.querySelector('[data-testid=signaturecinematic]');
  for (const a of root?.getAnimations({ subtree: true }) ?? []) {
    a.pause();
    a.currentTime = ms;
  }
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
}

const el = document.createElement('div');
document.body.appendChild(el);
createRoot(el).render(<Preview />);
(window as unknown as { __sigfx: unknown }).__sigfx = { seek, show, moves: Object.keys(SIGNATURE_CINEMATICS) };
if (frozen !== null) void seek(Number(frozen));
else {
  show();
  setInterval(show, sig.totalMs - skipMs(sig, mode) + 700);
}
