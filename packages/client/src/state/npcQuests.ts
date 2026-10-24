/**
 * NPC side quests on the client (2026-10-24): the server calls behind the dialogue's favour card and the journal's
 * Favours tab, and the toast when one is done. Everything here is the server's word: an offer is stored by
 * `POST /npc/quests/offer` (after the tool pass heard the NPC ask), answered by `POST /npc/quests/answer`, handed in by
 * `POST /npc/quests/claim` (the reward lands in the session like any inventory delta).
 *
 * A favour's progress reaches the session as a `questProgress` entry (`npc:<id>`, from the battle's or the crossing's
 * `progressionDelta`); when one turns done, `watchNpcQuests` toasts "Favour done" with who to go back to (one
 * `GET /npc/quests` for the name).
 */
import { NPC_QUEST_PREFIX } from '@ewa/protocol';
import type { NpcQuestState, NpcQuestView } from '@ewa/protocol';
import { apiFetch } from '../net/api';
import { zoneName } from '../data/content';
import { objectiveText, rewardText } from '../talk/npcQuest';
import { toast } from './notifications';
import { toInventoryDelta, useSessionStore } from './session';

export async function fetchNpcQuest(npcId: string): Promise<NpcQuestState> {
  return apiFetch('npcQuest', { params: { npcId } });
}

export async function offerNpcQuest(npcId: string): Promise<NpcQuestState> {
  return apiFetch('npcQuestOffer', { body: { npcId } });
}

export async function answerNpcQuest(questId: string, answer: 'accept' | 'decline' | 'abandon'): Promise<NpcQuestView> {
  const q = await apiFetch('npcQuestAnswer', { body: { questId, answer } });
  if (answer === 'accept') toast('info', `Favour accepted: ${objectiveText(q.objective)}.`);
  return q;
}

/** Hands the NPC's favour in: the reward lands in the session; returns the claimed favour and the standing after. */
export async function claimNpcQuest(npcId: string): Promise<{ readonly quest: NpcQuestView; readonly standing: number }> {
  const res = await apiFetch('npcQuestClaim', { body: { npcId } });
  const delta = toInventoryDelta({ money: res.money });
  useSessionStore.getState().applyInventoryDelta({ ...delta, items: res.items });
  toast('success', `Favour done for ${short(res.quest.npcName)}: ${rewardText(res.quest.reward)}.`);
  return { quest: res.quest, standing: res.standing };
}

function short(name: string): string {
  return name.split(',')[0]!.trim();
}

/** The favours whose `npc:` progress entry is done in `quests` */
function doneKeys(quests: Readonly<Record<string, Readonly<Record<string, { readonly done: boolean }>>>> | undefined): Set<string> {
  const out = new Set<string>();
  for (const [k, v] of Object.entries(quests ?? {})) if (k.startsWith(NPC_QUEST_PREFIX) && v['main']?.done === true) out.add(k.slice(NPC_QUEST_PREFIX.length));
  return out;
}

let unwatch: (() => void) | null = null;

/** Toasts a favour that just turned done (once per favour), with who to go back to. Idempotent. */
export function watchNpcQuests(): void {
  if (unwatch !== null) return;
  unwatch = useSessionStore.subscribe(
    (st) => st.progression?.quests,
    (quests, before) => {
      const was = doneKeys(before);
      const fresh = [...doneKeys(quests)].filter((id) => !was.has(id));
      if (fresh.length === 0) return;
      void apiFetch('npcQuests', {}).then(
        (list) => {
          for (const id of fresh) {
            const q = list.open.find((x) => x.id === id);
            toast('success', q === undefined ? 'Favour done: go back to the villager who asked.' : `Favour done: ${objectiveText(q.objective)}. Go back to ${short(q.npcName)} in ${zoneName(q.zoneId)}.`);
          }
        },
        () => toast('success', 'Favour done: go back to the villager who asked.'),
      );
    },
  );
}

export function stopWatchingNpcQuests(): void {
  unwatch?.();
  unwatch = null;
}
