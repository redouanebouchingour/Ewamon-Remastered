/**
 * `/play/settings` (SPEC §20.9.11, §20.8). Six tabs (`?tab=graphics|audio|accessibility|controls|social|world`); every
 * control is bound to useSettingsStore and applies immediately — no Save button. Accessibility's first item is the
 * reduced-motion tri-state with the current system value; while effective reduced motion is on, the dof / grain /
 * chroma / shake / hitstop / slow-mo toggles render disabled with "Off: reduced motion" (accessibility wins).
 * Controls is the remap table of §20.8.5.
 */
import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { TYPE_NAMES } from '@ewa/core';
import { REDUCED_LOCKED } from '../state/effective';
import { useEffectiveSettings } from '../state/applySettings';
import { INPUT_ACTIONS, UI_SCALE, bindingConflict, isBindable, useSettingsStore } from '../state/settings';
import type { Colorblind, FrameCap, GraphicsQualitySetting, GraphicsSettings, InputAction } from '../state/settings';
import { Button } from '../ui/Button';
import { Segmented, Select } from '../ui/Field';
import { Panel } from '../ui/Panel';
import { Slider } from '../ui/Slider';
import { Tabs } from '../ui/Tabs';
import { Toggle } from '../ui/Toggle';
import { TypeBadge } from '../ui/TypeBadge';
import { cx } from '../ui/cx';
import l from './layout.module.css';
import s from './SettingsScreen.module.css';
import { useClosePanel } from './shared';
import { EmailNudge } from './EmailNudge';
import { WeatherSection } from './WeatherSection';

type Tab = 'graphics' | 'audio' | 'accessibility' | 'controls' | 'social' | 'world';
const TABS: readonly { readonly key: Tab; readonly label: string }[] = [
  { key: 'graphics', label: 'Graphics' },
  { key: 'audio', label: 'Audio' },
  { key: 'accessibility', label: 'Accessibility' },
  { key: 'controls', label: 'Controls' },
  { key: 'social', label: 'Social' },
  { key: 'world', label: 'World' },
];

type EffectToggle = Exclude<keyof GraphicsSettings, 'reducedEffects' | 'renderScale' | 'quality' | 'frameCap' | 'showFps'>;
const EFFECT_TOGGLES: Readonly<Record<EffectToggle, { readonly label: string; readonly description: string }>> = {
  dof: { label: 'Depth of field', description: 'Soft focus on the distance. Never blurs your creature or an active battler.' },
  bloom: { label: 'Bloom', description: 'Glow around bright light. Static, so it stays available under reduced motion.' },
  grain: { label: 'Film grain', description: 'A subtle moving noise layer.' },
  chroma: { label: 'Chromatic aberration', description: 'Colour fringing on super-effective hits.' },
  shake: { label: 'Camera shake', description: 'The camera jolts on heavy impacts.' },
  hitstop: { label: 'Hitstop', description: 'A 50 ms freeze on every landed hit.' },
  slowmo: { label: 'Critical slow motion', description: 'Time slows briefly on a critical hit.' },
};

export const ACTION_LABEL: Readonly<Record<InputAction, string>> = {
  forward: 'Move forward',
  back: 'Move back',
  left: 'Strafe left',
  right: 'Strafe right',
  run: 'Run (hold)',
  interact: 'Interact',
  jump: 'Jump',
  bike: 'Bicycle (ride / fold)',
  fieldPower: "Lead's field power (Psychic: sense ghosts)",
  chat: 'Open chat',
  emote1: 'Emote: wave',
  emote2: 'Emote: happy',
  emote3: 'Emote: sad',
  emote4: 'Emote: alert',
  emote5: 'Emote: heart',
  emote6: 'Emote: cool',
  challenge: 'Challenge nearest player',
  rotateLeft: 'Rotate camera left',
  rotateRight: 'Rotate camera right',
  party: 'Open party',
  bag: 'Open bag',
  journal: 'Open journal (dex)',
  map: 'Open world map',
  pvp: 'Open PvP (arena)',
  professor: 'Ask Prof. Wynn',
  pause: 'Pause / settings',
  toggleHud: 'Toggle HUD',
};

const ARROWS: Readonly<Record<string, string>> = { ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→' };

/** A readable label for a KeyboardEvent.code (stored codes keep AZERTY working by physical position). */
export function keyLabel(code: string): string {
  if (ARROWS[code] !== undefined) return ARROWS[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  const side = /^(Shift|Control|Alt|Meta)(Left|Right)$/.exec(code);
  if (side !== null) return `${side[2]} ${side[1] === 'Control' ? 'Ctrl' : side[1]}`;
  if (code === 'Escape') return 'Esc';
  return code;
}

function GraphicsTab() {
  const g = useSettingsStore((st) => st.graphics);
  const set = useSettingsStore((st) => st.set);
  const eff = useEffectiveSettings();
  const locked = new Set<string>(REDUCED_LOCKED);
  return (
    <div className={s.tab}>
      <div className={s.control}>
        <div>
          <p className={s.controlLabel}>Quality</p>
          <p className={l.caption}>Low renders at 1× pixel density without ambient occlusion, depth of field or bloom and with half the shadow detail. Auto picks Low on Intel integrated graphics.</p>
        </div>
        <Segmented<GraphicsQualitySetting>
          label="Quality"
          value={g.quality}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'low', label: 'Low' },
            { value: 'medium', label: 'Medium' },
            { value: 'high', label: 'High' },
          ]}
          onChange={(v) => set('graphics', { quality: v })}
        />
      </div>
      <div className={s.control}>
        <div>
          <p className={s.controlLabel}>Frame rate cap</p>
          <p className={l.caption}>
            A lower cap leaves the GPU and CPU idle between frames: cooler, quieter, longer battery. Unlimited draws as fast as the GPU
            can, beyond what the display shows.
          </p>
        </div>
        <Segmented<'30' | '60' | '0' | '-1'>
          label="Frame rate cap"
          value={String(g.frameCap) as '30' | '60' | '0' | '-1'}
          options={[
            { value: '30', label: '30' },
            { value: '60', label: '60' },
            { value: '0', label: 'Display' },
            { value: '-1', label: 'Unlimited' },
          ]}
          onChange={(v) => set('graphics', { frameCap: Number(v) as FrameCap })}
        />
      </div>
      <Toggle
        label="Show FPS"
        description="Frames per second in the top bar, updated every second."
        checked={g.showFps}
        onChange={(v) => set('graphics', { showFps: v })}
      />
      <Toggle
        label="Reduced effects"
        description="Turns off grain, aberration, shake, hitstop, slow motion and depth of field in one switch."
        checked={g.reducedEffects}
        onChange={(v) => set('graphics', { reducedEffects: v })}
      />
      <div className={s.control}>
        <div>
          <p className={s.controlLabel}>Render scale</p>
          <p className={l.caption}>75 % renders fewer pixels for smoother frames on slower GPUs.</p>
        </div>
        <Segmented
          label="Render scale"
          value={String(g.renderScale) as '0.75' | '1'}
          options={[
            { value: '0.75', label: '75 %' },
            { value: '1', label: '100 %' },
          ]}
          onChange={(v) => set('graphics', { renderScale: v === '0.75' ? 0.75 : 1 })}
        />
      </div>
      <hr className={l.divider} />
      {(Object.keys(EFFECT_TOGGLES) as EffectToggle[]).map((k) => {
        const off = eff.reduced && locked.has(k);
        return (
          <Toggle
            key={k}
            label={EFFECT_TOGGLES[k].label}
            description={off ? 'Off: reduced motion' : EFFECT_TOGGLES[k].description}
            checked={off ? false : g[k]}
            disabled={off}
            onChange={(v) => set('graphics', { [k]: v } as Partial<GraphicsSettings>)}
          />
        );
      })}
      <div className={l.notice}>Live renderer stats (draw calls, GPU ms) appear here once the world renderer is running.</div>
    </div>
  );
}

function AudioTab() {
  const a = useSettingsStore((st) => st.audio);
  const set = useSettingsStore((st) => st.set);
  const pct = (v: number): string => `${Math.round(v * 100)} %`;
  return (
    <div className={s.tab}>
      <Slider label="Master" value={a.master} min={0} max={1} step={0.05} format={pct} onChange={(v) => set('audio', { master: v })} />
      <Slider label="Music" value={a.music} min={0} max={1} step={0.05} format={pct} onChange={(v) => set('audio', { music: v })} />
      <Slider label="Sound effects" value={a.sfx} min={0} max={1} step={0.05} format={pct} onChange={(v) => set('audio', { sfx: v })} />
      <Slider label="Interface" value={a.ui} min={0} max={1} step={0.05} format={pct} onChange={(v) => set('audio', { ui: v })} />
      <Toggle label="Mute when the tab is hidden" checked={a.muteWhenHidden} onChange={(v) => set('audio', { muteWhenHidden: v })} />
      <p className={l.caption}>
        Music and sound effects credits: <a href="/audio/CREDITS.txt" target="_blank" rel="noreferrer">audio credits</a> (CC0 sources).
      </p>
    </div>
  );
}

function AccessibilityTab() {
  const a = useSettingsStore((st) => st.accessibility);
  const set = useSettingsStore((st) => st.set);
  const eff = useEffectiveSettings();
  return (
    <div className={s.tab}>
      <div className={s.control}>
        <div>
          <p className={s.controlLabel}>Reduced motion</p>
          <p className={l.caption}>
            Your system currently {eff.systemPrefersReduced ? 'asks for' : 'does not ask for'} reduced motion. Effective now:{' '}
            <strong className={eff.reduced ? l.accentText : undefined}>{eff.reduced ? 'on' : 'off'}</strong>.
          </p>
        </div>
        <Segmented
          label="Reduced motion"
          value={a.reducedMotion}
          options={[
            { value: 'system', label: 'System' },
            { value: 'on', label: 'On' },
            { value: 'off', label: 'Off' },
          ]}
          onChange={(v) => set('accessibility', { reducedMotion: v })}
        />
      </div>
      <div className={s.control}>
        <div>
          <p className={s.controlLabel}>Colour vision</p>
          <p className={l.caption}>Swaps the type palette; every badge keeps its two-letter glyph.</p>
        </div>
        <Select<Colorblind>
          label="Colour vision"
          hideLabel
          value={a.colorblind}
          options={[
            { value: 'none', label: 'Default palette' },
            { value: 'deuteranopia', label: 'Deuteranopia' },
            { value: 'protanopia', label: 'Protanopia' },
            { value: 'tritanopia', label: 'Tritanopia' },
          ]}
          onChange={(v) => set('accessibility', { colorblind: v })}
        />
      </div>
      <div className={s.typePreview} aria-label="Type palette preview">
        {TYPE_NAMES.map((t) => (
          <TypeBadge key={t} type={t} size="sm" />
        ))}
      </div>
      <Slider
        label="Interface scale"
        value={a.uiScale}
        min={UI_SCALE.min}
        max={UI_SCALE.max}
        step={UI_SCALE.step}
        format={(v) => `${Math.round(v * 100)} %`}
        onChange={(v) => set('accessibility', { uiScale: v })}
      />
      <p className={s.scalePreview}>The quick brown bramblecub jumps over the lazy glimfin — text previews at this scale.</p>
      <div className={s.control}>
        <div>
          <p className={s.controlLabel}>Battle text speed</p>
          <p className={l.caption}>Instant removes the reading pause and the HP drain animation.</p>
        </div>
        <Segmented
          label="Battle text speed"
          value={a.battleTextSpeed}
          options={[
            { value: 'normal', label: 'Normal' },
            { value: 'fast', label: 'Fast' },
            { value: 'instant', label: 'Instant' },
          ]}
          onChange={(v) => set('accessibility', { battleTextSpeed: v })}
        />
      </div>
      <Toggle label="Screen flash on impact" description="The white full-screen flash on heavy hits (the creature still flashes)." checked={a.screenFlash} onChange={(v) => set('accessibility', { screenFlash: v })} />
      <Toggle
        label="Battle commentator"
        description="A broadcast caption over the arena calls the big moments: crits, knockouts, comebacks, the win."
        checked={a.battleCommentary}
        onChange={(v) => set('accessibility', { battleCommentary: v })}
      />
      <Toggle
        label="Trainer banter"
        description="The trainer you fight talks during the battle: at the start, when you knock one out, at the end."
        checked={a.trainerBanter}
        onChange={(v) => set('accessibility', { trainerBanter: v })}
      />
      <Toggle
        label="Show the speedrun timer"
        description="Your play time, as the server counts it, in the top bar. It runs only while you are in the world."
        checked={a.speedrunTimer}
        onChange={(v) => set('accessibility', { speedrunTimer: v })}
      />
    </div>
  );
}

function ControlsTab() {
  const binds = useSettingsStore((st) => st.keybinds);
  const set = useSettingsStore((st) => st.set);
  const reset = useSettingsStore((st) => st.resetKeybinds);
  const [capture, setCapture] = useState<{ readonly action: InputAction; readonly slot: 0 | 1 } | null>(null);
  const [message, setMessage] = useState<{ readonly action: InputAction; readonly text: string } | null>(null);

  useEffect(() => {
    if (capture === null) return;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      const { action, slot } = capture;
      const current = [...binds[action]];
      if (e.code === 'Escape') {
        setCapture(null);
        return;
      }
      if (e.code === 'Backspace') {
        if (current.length > 1 || slot === 1) current.splice(slot, 1);
        set('keybinds', { [action]: current.length > 0 ? current : binds[action] } as never);
        setCapture(null);
        setMessage(null);
        return;
      }
      if (!isBindable(e.code)) {
        setMessage({ action, text: `${keyLabel(e.code)} cannot be bound.` });
        return;
      }
      const clash = bindingConflict(binds, action, e.code);
      if (clash !== null) {
        setMessage({ action, text: `Already bound to ${ACTION_LABEL[clash]}` });
        return;
      }
      current[slot] = e.code;
      set('keybinds', { [action]: current.filter(Boolean).slice(0, 2) } as never);
      setCapture(null);
      setMessage(null);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [capture, binds, set]);

  return (
    <div className={s.tab}>
      <div className={l.rowBetween}>
        <p className={l.muted}>Click a binding, then press a key. Esc cancels, Backspace clears.</p>
        <Button size="sm" variant="ghost" icon="refresh" onClick={reset}>
          Reset to defaults
        </Button>
      </div>
      <table className={s.binds}>
        <thead>
          <tr>
            <th scope="col">Action</th>
            <th scope="col">Primary</th>
            <th scope="col">Secondary</th>
          </tr>
        </thead>
        <tbody>
          {INPUT_ACTIONS.map((a) => (
            <tr key={a}>
              <th scope="row" className={s.actionCell}>
                {ACTION_LABEL[a]}
                {message?.action === a && <span className={s.bindError}>{message.text}</span>}
              </th>
              {([0, 1] as const).map((slot) => {
                const active = capture?.action === a && capture.slot === slot;
                const code = binds[a][slot];
                return (
                  <td key={slot}>
                    <button type="button" className={cx(s.key, active && s.keyActive, code === undefined && s.keyEmpty)} onClick={() => setCapture({ action: a, slot })} aria-label={`${ACTION_LABEL[a]} ${slot === 0 ? 'primary' : 'secondary'} binding: ${code === undefined ? 'none' : keyLabel(code)}`}>
                      {active ? 'Press a key…' : code === undefined ? '—' : keyLabel(code)}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SocialTab() {
  const so = useSettingsStore((st) => st.social);
  const set = useSettingsStore((st) => st.set);
  return (
    <div className={s.tab}>
      <Toggle label="Show world chat" checked={so.showChat} onChange={(v) => set('social', { showChat: v })} />
      <Toggle label="Allow battle challenges" checked={so.allowChallenges} onChange={(v) => set('social', { allowChallenges: v })} />
      <Toggle label="Allow trade requests" checked={so.allowTrades} onChange={(v) => set('social', { allowTrades: v })} />
      <div className={s.control}>
        <p className={s.controlLabel}>Direct messages from</p>
        <Segmented
          label="Direct messages from"
          value={so.allowDmsFrom}
          options={[
            { value: 'everyone', label: 'Everyone' },
            { value: 'friends', label: 'Friends only' },
          ]}
          onChange={(v) => set('social', { allowDmsFrom: v })}
        />
      </div>
    </div>
  );
}

export function SettingsScreen() {
  const close = useClosePanel();
  const [params, setParams] = useSearchParams();
  const raw = params.get('tab');
  const tab: Tab = TABS.some((t) => t.key === raw) ? (raw as Tab) : 'graphics';
  return (
    <Panel
      title="Settings"
      eyebrow="Changes apply instantly"
      onClose={close}
      toolbar={<Tabs<Tab> label="Settings" tabs={TABS} value={tab} onChange={(k) => setParams({ tab: k }, { replace: true })} />}
    >
      <div className={s.wrap}>
        <EmailNudge />
        {tab === 'graphics' && <GraphicsTab />}
        {tab === 'audio' && <AudioTab />}
        {tab === 'accessibility' && <AccessibilityTab />}
        {tab === 'controls' && <ControlsTab />}
        {tab === 'social' && <SocialTab />}
        {tab === 'world' && (
          <div className={s.tab}>
            <WeatherSection />
          </div>
        )}
      </div>
    </Panel>
  );
}
