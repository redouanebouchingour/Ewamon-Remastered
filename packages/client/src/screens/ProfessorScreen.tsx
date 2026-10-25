/**
 * LLM feature 5 `/play/professor`: "Ask Prof. Wynn". The player types a question ("what beats Mira's team?", "where do
 * I find a fire type?"); the answer is the facts of their own save (talk/professorFacts.ts) at once, as a terse list
 * with the sprites and type icons it is about, and the professor's words over them when the model has them
 * (state/professor.ts). Opened from the top bar's More menu or its hotkey (`professor`, L by default).
 */
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router';
import { speciesName } from '../data/content';
import { noDashes } from '../talk/llm';
import { askProfessor, useProfessorStore } from '../state/professor';
import type { ProfEntry } from '../state/professor';
import { MAX_QUESTION } from '../state/professor';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { dexHref } from '../data/dexInfo';
import { Panel } from '../ui/Panel';
import { TypeBadge } from '../ui/TypeBadge';
import { cx } from '../ui/cx';
import s from './ProfessorScreen.module.css';
import { useClosePanel } from './shared';

/** questions offered as one-press chips */
export const SUGGESTIONS: readonly string[] = ['What should I do next?', 'Is my team good against the next gym?', 'What can I catch here?', 'Is my team any good?'];

function Answer({ entry }: { readonly entry: ProfEntry }) {
  const { sheet } = entry;
  const spoken = entry.text !== null;
  return (
    <li className={s.entry} data-testid="prof-entry">
      <p className={s.question}>
        <span className={s.you}>You</span>
        <span>{noDashes(entry.question)}</span>
      </p>
      <div className={s.answer} aria-live="polite" aria-busy={entry.pending || undefined}>
        <p className={s.speaker}>
          <span className={s.tag}>Prof. Wynn</span>
          <span className={s.topic}>{noDashes(sheet.title)}</span>
        </p>
        {spoken && (
          <p className={s.text} data-testid="prof-text">
            {noDashes(entry.text ?? '')}
          </p>
        )}
        {entry.pending && (
          <p className={s.thinking} data-testid="prof-thinking">
            Thinking it over…
          </p>
        )}
        {(sheet.species.length > 0 || sheet.types.length > 0) && (
          <div className={s.strip} aria-label="About">
            {sheet.species.map((id) => (
              <Link key={id} to={dexHref(id)} className={s.dexLink} aria-label={`${speciesName(id)} in the Dex`} title="Open its Dex entry">
                <CreatureSprite speciesId={id} size="sm" />
              </Link>
            ))}
            {sheet.types.map((t) => (
              <TypeBadge key={t} type={t} size="sm" />
            ))}
          </div>
        )}
        <ul className={cx(s.facts, spoken && s.factsQuiet)} aria-label={spoken ? 'The facts' : 'Answer'} data-testid="prof-facts">
          {sheet.facts.map((f) => (
            <li key={f}>{noDashes(f)}</li>
          ))}
        </ul>
      </div>
    </li>
  );
}

export function ProfessorScreen() {
  const close = useClosePanel();
  const entries = useProfessorStore((st) => st.entries);
  const [draft, setDraft] = useState('');
  const input = useRef<HTMLInputElement>(null);
  const end = useRef<HTMLDivElement>(null);
  useEffect(() => {
    input.current?.focus();
  }, []);
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: 'end' });
  }, [entries]);
  const ask = (q: string): void => {
    if (q.trim() === '') return;
    setDraft('');
    void askProfessor(q);
  };
  const onSubmit = (e: FormEvent): void => {
    e.preventDefault();
    ask(draft);
  };
  return (
    <Panel title="Ask Prof. Wynn" eyebrow="Professor" subtitle="Answers from your own save: party, box, badges and the dex." onClose={close} bodyClassName={s.body}>
      {entries.length === 0 && (
        <p className={s.intro}>
          Ask about an Ewamon, a type, a gym leader, an item or a place, about your team, or what to do next.
        </p>
      )}
      <ol className={s.entries} aria-label="Questions and answers">
        {entries.map((e) => (
          <Answer key={e.id} entry={e} />
        ))}
      </ol>
      <div ref={end} />
      <div className={s.chips} aria-label="Suggestions">
        {SUGGESTIONS.map((q) => (
          <button key={q} type="button" className={s.chip} onClick={() => ask(q)}>
            {q}
          </button>
        ))}
      </div>
      <form className={s.form} onSubmit={onSubmit}>
        <label className="visually-hidden" htmlFor="prof-question">
          Your question
        </label>
        <input
          ref={input}
          id="prof-question"
          className={s.input}
          type="text"
          autoComplete="off"
          maxLength={MAX_QUESTION}
          placeholder="Where do I find a fire type?"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button type="submit" variant="primary" disabled={draft.trim() === ''}>
          Ask
        </Button>
      </form>
    </Panel>
  );
}
