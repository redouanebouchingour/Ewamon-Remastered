/**
 * Music that follows the battle: the hp bands; a battle's mood from the player's active battler (a Majin / Tenjin form
 * it holds); the stem levels and the low-pass each mood gives; the controller hands the view the mood at the start and
 * clears it when the battle closes.
 */
import { describe, expect, it } from 'vitest';
import { createContentIndex } from '@ewa/content';
import { calcMaxHp, digestBattleState } from '@ewa/core';
import type { BattleState } from '@ewa/core';
import { musicLowpassHz, stemLevel } from '../src/audio/AudioDirector';
import { MIXER } from '../src/audio/mixer';
import { createBattleController } from '../src/battle/BattleController';
import type { BattleView } from '../src/battle/BattleController';
import { STEP_MS } from '../src/battle/constants';
import { STEADY_MOOD, battleMood, hpBand } from '../src/battle/mood';
import type { BattleMood } from '../src/battle/mood';
import { useUiStore } from '../src/state/ui';
import { makeCreature, startBattle } from './battleFuzz';

const content = createContentIndex();

describe('battle mood', () => {
  it('hp bands: steady above half, low to a quarter, critical below', () => {
    expect(hpBand(1)).toBe('steady');
    expect(hpBand(0.51)).toBe('steady');
    expect(hpBand(MIXER.battleMood.lowAt)).toBe('low');
    expect(hpBand(0.3)).toBe('low');
    expect(hpBand(MIXER.battleMood.criticalAt)).toBe('critical');
    expect(hpBand(0.01)).toBe('critical');
  });

  it("a battle's mood follows the player's active battler and its Majin / Tenjin form", () => {
    const majin = content.allSpecies().find((sp) => sp.battleForm?.kind === 'majin')!;
    const tenjin = content.allSpecies().find((sp) => sp.battleForm?.kind === 'tenjin')!;
    const foe = makeCreature(content, content.species('mossling'), 5, 'foe', null);
    const mk = (sp: typeof majin): BattleState => startBattle(content, 3, 'trainer', [makeCreature(content, sp, 50, 'me', 'p0')], [foe]).state;
    const st = mk(majin);
    const max = st.sides[0].party[0]!.maxHp;
    expect(battleMood(st, 0, () => max, content)).toEqual(STEADY_MOOD);
    expect(battleMood(st, 0, () => Math.floor(max * 0.2), content)).toEqual({ hp: 'critical', form: 'none' });
    const formed: BattleState = { ...st, sides: [{ ...st.sides[0], party: [{ ...st.sides[0].party[0]!, form: majin.battleForm!.id }] }, st.sides[1]] };
    expect(battleMood(formed, 0, () => Math.floor(max * 0.4), content)).toEqual({ hp: 'low', form: 'majin' });
    const t = mk(tenjin);
    const tf: BattleState = { ...t, sides: [{ ...t.sides[0], party: [{ ...t.sides[0].party[0]!, form: tenjin.battleForm!.id }] }, t.sides[1]] };
    expect(battleMood(tf, 0, () => t.sides[0].party[0]!.maxHp, content).form).toBe('tenjin');
  });

  it('stem levels and the low-pass per mood', () => {
    const at = (mood: BattleMood | null, threat = true) => ({ base: stemLevel('base', { threat, night: 0.5, harvested: false, mood }), biome: stemLevel('biome', { threat, night: 0.5, harvested: false, mood }), threat: stemLevel('threat', { threat, night: 0.5, harvested: false, mood }) });
    expect(at(null)).toEqual({ base: 1, biome: 1, threat: 1 });
    expect(at(STEADY_MOOD)).toEqual({ base: 1, biome: 1, threat: 1 });
    expect(at({ hp: 'low', form: 'none' })).toEqual({ base: 1, biome: MIXER.battleMood.low.biome, threat: 1 });
    expect(at({ hp: 'critical', form: 'none' })).toEqual({ base: MIXER.battleMood.critical.base, biome: 0, threat: MIXER.battleMood.critical.threat });
    expect(at({ hp: 'steady', form: 'majin' }).threat).toBe(MIXER.battleMood.majin.threat);
    expect(at({ hp: 'steady', form: 'tenjin' }).biome).toBe(MIXER.battleMood.tenjin.biome);
    expect(at({ hp: 'critical', form: 'none' }, false).threat).toBe(0);
    expect(musicLowpassHz(false, null)).toBe(22050);
    expect(musicLowpassHz(false, { hp: 'steady', form: 'majin' })).toBe(MIXER.battleMood.majin.lowpassHz);
    expect(musicLowpassHz(true, { hp: 'steady', form: 'majin' })).toBe(Math.min(MIXER.harvestLowpass.hz, MIXER.battleMood.majin.lowpassHz));
  });

  it('the controller gives the view the mood at the start and clears it when the battle closes', () => {
    useUiStore.getState().reset();
    const moods: (BattleMood | null)[] = [];
    const noop = () => undefined;
    const view: BattleView = {
      enterBattle: noop, exitBattle: noop, setBattler: noop, setPose: noop, hurt: noop, vfx: noop, prewarm: noop, syncFrom: noop, setWeather: noop, cue: noop, shake: noop,
      setTimeScale: noop, hitstopEnabled: () => false, slowmoEnabled: () => false, playSfx: noop, setBattleHud: noop, setThreat: noop, setMood: (m) => void moods.push(m),
    };
    const c = createBattleController({ content, send: noop, reduced: () => true, instantText: () => true, selfPosition: () => ({ x: 0, z: 0 }), summaryAt: () => null, selfId: () => 'p0', raidId: () => null, view, defer: (fn) => fn() });
    const me = makeCreature(content, content.species('bramblecub'), 20, 'me', 'p0');
    const hurt = { ...me, hp: Math.max(1, Math.floor(calcMaxHp(content.species('bramblecub').baseHp, 20) * 0.2)) };
    const { state, events } = startBattle(content, 5, 'wild', [hurt], [makeCreature(content, content.species('mossling'), 3, 'w', null)]);
    c.onBattleStart({ type: 'battleStart', battleId: '00000000-0000-4000-8000-0000000000aa', format: 'wild', seat: 0, state, events, stateDigest: digestBattleState(state) });
    for (let i = 0; i < 2000 && c.player.isPlaying; i++) c.player.step(STEP_MS);
    expect(moods.at(-1)).toEqual({ hp: 'critical', form: 'none' });
    c.reset();
    expect(moods.at(-1)).toBeNull();
  });
});
