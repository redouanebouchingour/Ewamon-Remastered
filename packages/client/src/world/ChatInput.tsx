/**
 * SPEC §20.4.5 / §20.9.2 chat input: hidden until `T` (World3D opens it through `ui.chatOpen`); `Enter` sends
 * `chat { text }` (1..120 chars, AOI-scoped by the server), `Escape` closes. Received lines are drawn by the canvas
 * HUD (§20.6), not here — this is the one DOM input the world owns.
 */
import { useEffect, useRef, useState } from 'react';
import { getWorldSession } from '../net/WorldSession';
import { useUiStore } from '../state/ui';
import s from './ChatInput.module.css';

export const CHAT_MAX = 120;

export function ChatInput() {
  const open = useUiStore((st) => st.chatOpen);
  const [text, setText] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) ref.current?.focus();
    else setText('');
  }, [open]);

  if (!open) return null;
  const close = (): void => {
    useUiStore.getState().setChatOpen(false);
    ref.current?.blur();
  };
  const send = (): void => {
    const t = text.trim();
    if (t.length > 0) getWorldSession().send('chat', { text: t.slice(0, CHAT_MAX) });
    close();
  };
  return (
    <form
      className={s.chat}
      data-testid="chatinput"
      onSubmit={(e) => {
        e.preventDefault();
        send();
      }}
    >
      <label className={s.label} htmlFor="ewa-chat">
        Say
      </label>
      <input
        id="ewa-chat"
        ref={ref}
        className={s.input}
        value={text}
        maxLength={CHAT_MAX}
        autoComplete="off"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
        onBlur={() => useUiStore.getState().setChatOpen(false)}
        placeholder="Message nearby trainers"
      />
      {text.length > 100 && <span className={s.count}>{CHAT_MAX - text.length}</span>}
    </form>
  );
}
