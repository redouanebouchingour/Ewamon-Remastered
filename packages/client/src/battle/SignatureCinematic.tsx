/**
 * A signature move's cinematic (signatures.ts) over the arena: a letterboxed dim, the cut-in band (the creature's
 * portrait, an eye glint, the move's name), then the move's own SVG effect (sigfx/*) aimed from the attacker to the target at their
 * projected screen positions. Pure CSS animation on one clock: mounting a cue (keyed by its id) starts it, `--skip`
 * starts a short cue past the band; nothing is written per frame. The 3D stage plays the move underneath (poses, the
 * rage burst, the hit, the camera shake). Non-interactive and hidden from assistive tech (the log names the move).
 */
import { useEffect } from 'react';
import { cssVars } from '../ui/cssVars';
import type { CssVarMap } from '../ui/cssVars';
import { useCinematicStore } from './cinematic';
import type { CinematicCue, CinematicPoint } from './cinematic';
import s from './SignatureCinematic.module.css';
import { SIG_FX } from './sigfx';
import type { FxKit } from './sigfx/kit';
import { impactAt, signatureOf, skipMs } from './signatures';
import type { SignatureCinematic as Sig } from './signatures';

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));

/** The overlay's custom properties: both battlers' points, the line between them, the clock and the move's palette. */
export function cinematicVars(cue: CinematicCue, sig: Sig, vw: number, vh: number): CssVarMap {
  const near: CinematicPoint = { x: 0.28 * vw, y: 0.64 * vh, h: 0.42 * vh };
  const far: CinematicPoint = { x: 0.72 * vw, y: 0.36 * vh, h: 0.28 * vh };
  const a = cue.from ?? (cue.fromNear ? near : far);
  const d = cue.to ?? (cue.fromNear ? far : near);
  const sc = Math.max(0.2, vh / 900);
  const dx = d.x - a.x;
  const dy = d.y - a.y;
  return {
    '--ax': a.x.toFixed(1),
    '--ay': a.y.toFixed(1),
    '--dx': d.x.toFixed(1),
    '--dy': d.y.toFixed(1),
    '--ang': ((Math.atan2(dy, dx) * 180) / Math.PI).toFixed(2),
    '--dist': (Math.hypot(dx, dy) / sc).toFixed(1),
    '--sc': sc.toFixed(4),
    '--sa': clamp(a.h / 500, 0.35, 1.6).toFixed(4),
    '--sd': clamp(d.h / 300, 0.35, 1.8).toFixed(4),
    '--skip': `${skipMs(sig, cue.mode)}ms`,
    '--gx': `${sig.glint[0]}%`,
    '--gy': `${sig.glint[1]}%`,
    '--impact': `${impactAt(sig)}ms`,
    '--total': `${sig.totalMs}ms`,
    '--accent': sig.palette.accent,
    '--deep': sig.palette.deep,
    '--hot': sig.palette.hot,
  };
}

/** The shared positioning classes every effect layer draws in (sigfx/kit.ts). */
const KIT: FxKit = { svg: s.fx!, atA: s.atA!, atD: s.atD!, line: s.line!, rot: s.rot!, vb: s.vb! };

export function SignatureCinematic() {
  const cue = useCinematicStore((st) => st.cue);
  const sig = cue === null ? undefined : signatureOf(cue.move);
  // a cue's clock starts when it is shown: `aim` updates (same id) keep it running
  const cueId = cue?.id ?? null;
  const lifeMs = cue === null || sig === undefined ? 0 : sig.totalMs - skipMs(sig, cue.mode);
  useEffect(() => {
    if (cueId === null) return;
    const t = setTimeout(() => useCinematicStore.getState().clear(cueId), lifeMs);
    return () => clearTimeout(t);
  }, [cueId, lifeMs]);
  if (cue === null || sig === undefined) return null;
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const classes = cue.reduced ? `${s.root} ${s.reduced}` : s.root;
  const Fx = SIG_FX[sig.fx];
  return (
    <div key={cue.id} className={classes} style={cssVars(cinematicVars(cue, sig, vw, vh))} data-testid="signaturecinematic" data-move={cue.move} data-mode={cue.mode} aria-hidden="true">
      <div className={s.dim} />
      <div className={s.tint} />
      {!cue.reduced && <Fx k={KIT} />}
      {cue.mode === 'full' && (
        <div className={s.cutin}>
          <div className={s.band}>
            <div className={s.speed} />
            <div className={s.portrait}>
              <img src={`/signature/${sig.portrait}.webp`} alt="" draggable={false} />
              <svg className={s.glint} viewBox="-60 -60 120 120">
                <path d="M 0 -50 L 9 -9 L 50 0 L 9 9 L 0 50 L -9 9 L -50 0 L -9 -9 Z" fill="#fff" />
                <circle r="10" className={s.glintCore} />
              </svg>
            </div>
            <svg className={s.title} viewBox="0 0 300 130">
              <text className={s.kicker} x="2" y="14">{sig.kicker}</text>
              <g className={s.name}>
                <text className={s.nameShadow} x="5" y="68">{sig.lines[0]}</text>
                <text className={s.nameShadow} x="5" y="120">{sig.lines[1]}</text>
                <text className={s.nameText} x="2" y="65">{sig.lines[0]}</text>
                <text className={s.nameText} x="2" y="117">{sig.lines[1]}</text>
              </g>
            </svg>
          </div>
        </div>
      )}
      <div className={`${s.bar} ${s.top}`} />
      <div className={`${s.bar} ${s.bot}`} />
      {!cue.reduced && <div className={s.flash} />}
    </div>
  );
}
