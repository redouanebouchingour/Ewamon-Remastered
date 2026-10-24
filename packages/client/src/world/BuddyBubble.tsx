/**
 * Talk to your own Ewamon (LLM feature 6): the lead's ambient line as a small speech bubble over the follower. A DOM
 * overlay like the strike burst (render stays three-only): World3D writes the follower's head on screen into
 * `useBuddyBubbleStore` while a line shows, and the bubble's tail points down at it; when the follower is not on
 * screen the bubble sits above the player in the centre. It clears itself after the line's time. Reduced motion:
 * no pop, it just appears (the --motion-* tokens are 0 ms then).
 */
import { useEffect } from 'react';
import { clearBubble, useBuddyBubbleStore } from '../state/buddy';
import { noDashes } from '../talk/llm';
import { cssVars } from '../ui/cssVars';
import s from './BuddyBubble.module.css';

export function BuddyBubble() {
  const line = useBuddyBubbleStore((st) => st.line);
  const anchor = useBuddyBubbleStore((st) => st.anchor);
  useEffect(() => {
    if (line === null) return;
    const t = setTimeout(clearBubble, line.ms);
    return () => clearTimeout(t);
  }, [line]);
  if (line === null) return null;
  return (
    <p
      key={line.seq}
      className={s.bubble}
      data-anchored={anchor !== null || undefined}
      style={cssVars({ '--bx': `${anchor?.x ?? 0}px`, '--by': `${anchor?.y ?? 0}px` })}
      role="status"
      data-testid="buddy-bubble"
    >
      {noDashes(line.text)}
    </p>
  );
}
