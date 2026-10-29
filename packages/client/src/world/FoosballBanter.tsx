/**
 * The Mire Route foosball club's banter (state/foosballBanter.ts): the current line as a speech bubble over the
 * speaker's head, the buddy bubble's look. Only while the head is on screen; World3D times the lines.
 */
import { useFoosballBanterStore } from '../state/foosballBanter';
import { cssVars } from '../ui/cssVars';
import s from './FoosballBanter.module.css';

export function FoosballBanter() {
  const line = useFoosballBanterStore((st) => st.line);
  const anchor = useFoosballBanterStore((st) => st.anchor);
  if (line === null || anchor === null) return null;
  return (
    <p
      key={line.seq}
      className={s.bubble}
      style={cssVars({ '--bx': `${anchor.x}px`, '--by': `${anchor.y}px` })}
      data-by={line.by}
      data-testid="foosball-banter"
    >
      {line.text}
    </p>
  );
}
