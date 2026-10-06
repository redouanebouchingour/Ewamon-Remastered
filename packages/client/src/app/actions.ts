/**
 * Route actions (SPEC §20.1.2). Screens submit with `fetcher.submit(payload, { method: 'post',
 * encType: 'application/json' })`; the action reads `request.json()`, calls apiFetch, then maps the response
 * into applyInventoryDelta / applyProgressionDelta (the only writers) and returns data(result) or
 * data({ error }, { status }). The auth actions read the <Form> fields and redirect on success.
 */
import { data, redirect } from 'react-router';
import type { ActionFunctionArgs } from 'react-router';
import { RegisterReq } from '@ewa/protocol';
import type { InventoryDeltaBody } from '@ewa/protocol';
import type { CreatureInstance } from '@ewa/core';
import { itemInfo } from '../data/content';
import { ApiFailure, apiFetch, storeTokens } from '../net/api';
import { describeError, statusOf, toActionError } from '../net/errors';
import type { ActionError } from '../net/errors';
import { toast, useNotificationsStore } from '../state/notifications';
import { toInventoryDelta, toProgressionDelta, useSessionStore } from '../state/session';
import { useQuestTracking } from '../state/questTracking';
import { questById } from '../data/quests';
import { presentItemUse } from './itemUseFeedback';

// ---- auth ---------------------------------------------------------------------------------------------

export interface AuthActionData {
  readonly fieldErrors?: Readonly<Partial<Record<'username' | 'email' | 'password' | 'starter', string>>>;
  readonly formError?: string;
}

/** Only same-origin paths survive `?next=` (no protocol-relative `//evil`). */
export function safeNext(next: string | null): string {
  if (next === null || !next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return '/play';
  return next;
}

function authFailure(e: unknown) {
  if (e instanceof ApiFailure) {
    if (e.error.code === 'banned') {
      const reason = e.error.extra?.['reason'];
      return data<AuthActionData>({ formError: typeof reason === 'string' && reason.length > 0 ? `This account is banned: ${reason}` : 'This account is banned.' }, { status: 403 });
    }
    return data<AuthActionData>({ formError: describeError(e) }, { status: statusOf(e) });
  }
  return data<AuthActionData>({ formError: describeError(e) }, { status: 500 });
}

export async function loginAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const username = String(form.get('username') ?? '').trim().toLowerCase();
  const password = String(form.get('password') ?? '');
  const fieldErrors: Record<string, string> = {};
  if (username.length === 0) fieldErrors['username'] = 'Enter your username.';
  if (password.length === 0) fieldErrors['password'] = 'Enter your password.';
  if (Object.keys(fieldErrors).length > 0) return data<AuthActionData>({ fieldErrors }, { status: 400 });
  try {
    const res = await apiFetch('authLogin', { body: { username, password } });
    storeTokens(res.access, res.refresh);
  } catch (e) {
    if (e instanceof ApiFailure && e.error.status === 401) return data<AuthActionData>({ fieldErrors: { password: 'Wrong username or password.' } }, { status: 401 });
    return authFailure(e);
  }
  return redirect(safeNext(new URL(request.url).searchParams.get('next')));
}

const REGISTER_FIELD_COPY: Readonly<Record<string, string>> = {
  username: '3–20 characters: lowercase letters, digits or _.',
  email: 'Enter a valid email address.',
  password: 'Use 8 to 128 characters.',
  starter: 'Choose your first companion.',
};

export async function registerAction({ request }: ActionFunctionArgs) {
  const form = await request.formData();
  const raw = {
    username: String(form.get('username') ?? '').trim().toLowerCase(),
    email: String(form.get('email') ?? '').trim(),
    password: String(form.get('password') ?? ''),
    starter: String(form.get('starter') ?? ''),
  };
  const parsed = RegisterReq.safeParse(raw);
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const f = String(issue.path[0] ?? '');
      if (f in REGISTER_FIELD_COPY && fieldErrors[f] === undefined) fieldErrors[f] = REGISTER_FIELD_COPY[f]!;
    }
    return data<AuthActionData>({ fieldErrors }, { status: 400 });
  }
  try {
    const res = await apiFetch('authRegister', { body: parsed.data });
    storeTokens(res.access, res.refresh);
  } catch (e) {
    if (e instanceof ApiFailure && e.error.code === 'taken') {
      const field = e.error.extra?.['field'] === 'email' ? 'email' : 'username';
      return data<AuthActionData>(
        { fieldErrors: { [field]: field === 'email' ? 'That email is already registered.' : 'That username is taken.' } },
        { status: 409 },
      );
    }
    return authFailure(e);
  }
  return redirect('/play');
}

// ---- JSON intent actions ------------------------------------------------------------------------------------

export type ActionResult<T = unknown> = { readonly ok: true; readonly intent: string; readonly result?: T } | { readonly ok: false; readonly intent: string; readonly error: ActionError };

type Payload = Readonly<Record<string, unknown>> & { readonly intent: string };
type Handler = (p: Payload) => Promise<unknown>;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v));

async function readPayload(request: Request): Promise<Payload> {
  const body: unknown = await request.json();
  if (body === null || typeof body !== 'object' || typeof (body as { intent?: unknown }).intent !== 'string') {
    throw new ApiFailure({ status: 400, code: 'invalidPayload', detail: 'missing intent' });
  }
  return body as Payload;
}

function runner(handlers: Readonly<Record<string, Handler>>) {
  return async ({ request }: ActionFunctionArgs) => {
    let intent = 'unknown';
    try {
      const p = await readPayload(request);
      intent = p.intent;
      const h = handlers[p.intent];
      if (h === undefined) throw new ApiFailure({ status: 400, code: 'invalidPayload', detail: `unknown intent ${p.intent}` });
      const result = await h(p);
      return data<ActionResult>({ ok: true, intent, result });
    } catch (e) {
      const error = toActionError(e);
      toast('danger', error.message);
      return data<ActionResult>({ ok: false, intent, error }, { status: statusOf(e) });
    }
  };
}

const applyInv = (d: Parameters<typeof toInventoryDelta>[0]): void => useSessionStore.getState().applyInventoryDelta(toInventoryDelta(d));
/** A REST `inventoryDelta` body (server part 2 P1: setup, guild create, marketplace mutations) through the one writer. */
const applyDelta = (d: InventoryDeltaBody): void => useSessionStore.getState().applyInventoryDelta({ type: 'inventoryDelta', ...d });
/** Strips the `inventoryDelta` a mutation response carries after applying it; returns the view. */
function withDelta<T extends { readonly inventoryDelta: InventoryDeltaBody }>(res: T): Omit<T, 'inventoryDelta'> {
  const { inventoryDelta, ...view } = res;
  applyDelta(inventoryDelta);
  return view;
}
const updated = (c: CreatureInstance): void => applyInv({ creaturesUpdated: [c] });

/** Creature + party/box intents, shared by /play/party and /play/box. */
const CREATURE_HANDLERS: Readonly<Record<string, Handler>> = {
  async reorder(p) {
    const order = Array.isArray(p['order']) ? (p['order'] as unknown[]).map(str) : [];
    const res = await apiFetch('partyReorder', { body: { order } });
    applyInv({ party: res.party });
  },
  async nickname(p) {
    const nick = str(p['nickname']).trim();
    updated(await apiFetch('creatureNickname', { params: { id: str(p['id']) }, body: { nickname: nick.length === 0 ? null : nick } }));
  },
  async flags(p) {
    const body: { favorite?: boolean; locked?: boolean } = {};
    if (typeof p['favorite'] === 'boolean') body.favorite = p['favorite'];
    if (typeof p['locked'] === 'boolean') body.locked = p['locked'];
    updated(await apiFetch('creatureFlags', { params: { id: str(p['id']) }, body }));
  },
  async setup(p) {
    const held = str(p['heldItem']);
    const res = await apiFetch('creatureSetup', { params: { id: str(p['id']) }, body: { ability: str(p['ability']), heldItem: held.length === 0 ? null : held } });
    // the equipped / returned held items come back as an inventoryDelta body (server part 2, P1)
    const { inventoryDelta, ...creature } = res;
    applyDelta(inventoryDelta);
    updated(creature);
  },
  async moves(p) {
    const moves = Array.isArray(p['moves']) ? (p['moves'] as unknown[]).map(str) : [];
    updated(await apiFetch('creatureMoves', { params: { id: str(p['id']) }, body: { moves } }));
  },
  /** Phase D2: a TM lesson — the same `POST /creature/:id/moves` (the server checks the owned TM); the TM is kept */
  async teach(p) {
    const moves = Array.isArray(p['moves']) ? (p['moves'] as unknown[]).map(str) : [];
    updated(await apiFetch('creatureMoves', { params: { id: str(p['id']) }, body: { moves } }));
    toast('success', `${str(p['name'])} learned ${str(p['move'])}!`);
  },
  /** Phase D2: a move-tutor lesson for money; the money and the creature come back as an inventoryDelta body */
  async tutor(p) {
    const forget = str(p['forget']);
    const res = await apiFetch('creatureTutor', { params: { id: str(p['id']) }, body: { move: str(p['move']), forget: forget.length === 0 ? null : forget } });
    withDelta(res);
    toast('success', `${str(p['name'])} learned ${str(p['move'])}!`);
  },
  async release(p) {
    const id = str(p['id']);
    await apiFetch('creatureRelease', { params: { id } });
    applyInv({ creaturesRemoved: [id] });
    toast('info', 'Released. It returns to the wild.');
  },
  async withdraw(p) {
    const res = await apiFetch('partyWithdraw', { body: { id: str(p['id']) } });
    applyInv({ party: res.party, box: res.box });
  },
  async deposit(p) {
    const res = await apiFetch('partyDeposit', { body: { id: str(p['id']) } });
    applyInv({ party: res.party, box: res.box });
  },
  async swap(p) {
    const res = await apiFetch('partySwap', { body: { partyId: str(p['partyId']), boxId: str(p['boxId']) } });
    applyInv({ party: res.party, box: res.box });
  },
  async heal() {
    const res = await apiFetch('heal', {});
    applyInv({ party: res.party });
    toast('success', 'Your party is fully healed.');
  },
  async useItem(p) {
    const target = str(p['target']);
    const qty = num(p['qty'] ?? 1);
    const res = await apiFetch('itemUse', { body: { item: str(p['item']), target: target.length === 0 ? null : target, qty } });
    applyInv({ inventory: res.inventory, creaturesUpdated: res.creaturesUpdated });
    presentItemUse(str(p['item']), qty, res.creaturesUpdated[0], res.events);
  },
};

export const partyAction = runner(CREATURE_HANDLERS);
export const boxAction = runner(CREATURE_HANDLERS);
/**
 * Phase C5 `/play/bag`: `useItem` (with or without a target) is the creature intent; `give` is `setup` with the
 * creature's current ability and the new held item (the previous one returns to the bag server-side).
 */
export const bagAction = runner({
  useItem: CREATURE_HANDLERS['useItem']!,
  async give(p) {
    await CREATURE_HANDLERS['setup']!(p);
    toast('success', `${itemInfo(str(p['heldItem'])).name} given to ${str(p['name'])}.`);
  },
});

/**
 * Phase C4 `/play/profile`: `POST /profile { title, motto, body }` (the server refines title ∈ TITLES, body ∈ BODIES);
 * the identity lands through `applyProfile`, the one profile writer after hydrateFromMe.
 */
export const profileAction = runner({
  async save(p) {
    const res = await apiFetch('profile', { body: { title: str(p['title']), motto: str(p['motto']).trim(), body: str(p['body']) } });
    useSessionStore.getState().applyProfile({ title: res.title, motto: res.motto, body: res.body });
    toast('success', 'Profile saved.');
    return { title: res.title, motto: res.motto, body: res.body };
  },
});

export const shopAction = runner({
  async buy(p) {
    const res = await apiFetch('shopBuy', { body: { item: str(p['item']), qty: num(p['qty']) } });
    applyInv({ inventory: res.inventory, money: res.money });
    toast('success', `Bought ${num(p['qty'])} × ${itemInfo(str(p['item'])).name}.`);
  },
  async sell(p) {
    const res = await apiFetch('shopSell', { body: { item: str(p['item']), qty: num(p['qty']) } });
    applyInv({ inventory: res.inventory, money: res.money });
    toast('success', `Sold ${num(p['qty'])} × ${itemInfo(str(p['item'])).name}.`);
  },
});

export const passAction = runner({
  async claim(p) {
    const res = await apiFetch('battlePassClaim', { body: { level: num(p['level']) } });
    applyInv({ inventory: res.inventory, money: res.money, creaturesAdded: res.creaturesAdded });
    const n = useNotificationsStore.getState().pendingBattlePassClaims;
    useNotificationsStore.getState().setPendingClaims(Math.max(0, n - 1));
    toast('success', `Level ${num(p['level'])} reward claimed.`);
    return { claimed: res.claimed };
  },
  async mythical(p) {
    const species = str(p['species']) === 'noxmyth' ? 'noxmyth' : 'lumyth';
    const res = await apiFetch('battlePassMythical', { body: { species } });
    applyInv({ creaturesAdded: res.creaturesAdded });
    return { species };
  },
  /** a daily / weekly mission: `POST /quests/claim { questId: 'daily:<key>' | 'weekly:<key>', objectiveId: missionId }` */
  async claimMission(p) {
    const questId = str(p['questId']);
    const missionId = str(p['missionId']);
    const res = await apiFetch('questsClaim', { body: { questId, objectiveId: missionId } });
    applyInv({ inventory: res.inventory, money: res.money, creaturesAdded: res.creaturesAdded });
    useSessionStore.getState().applyProgressionDelta(toProgressionDelta({ questProgress: res.questProgress, missionClaimed: { questId, missionId } }));
    toast('success', 'Mission reward claimed.');
    return { questId, missionId };
  },
});

/**
 * Phase B3 `/play/quests`: a story quest's claim — `POST /quests/claim { questId }` (the server re-checks every
 * objective and grants money / items / creature / flag once; 409 questIncomplete / AlreadyClaimed). The grants go
 * through the two writers; the quest joins `questsClaimed` (and stops being tracked).
 */
export const questAction = runner({
  async claim(p) {
    const questId = str(p['questId']);
    const res = await apiFetch('questsClaim', { body: { questId } });
    applyInv({ inventory: res.inventory, money: res.money, creaturesAdded: res.creaturesAdded });
    const def = questById(questId);
    const flag = def?.rewards.flag ?? null;
    useSessionStore.getState().applyProgressionDelta(toProgressionDelta({ questProgress: res.questProgress, questClaimed: questId, ...(flag !== null ? { flags: [flag] } : {}) }));
    if (useQuestTracking.getState().tracked === questId) useQuestTracking.getState().setTracked(null);
    toast('success', `${def?.title ?? 'Quest'} complete. Rewards claimed.`);
    return { questId };
  },
});

export const socialAction = runner({
  async friendRequest(p) {
    return apiFetch('friendsRequest', { body: { username: str(p['username']).trim().toLowerCase() } });
  },
  async friendAccept(p) {
    return apiFetch('friendsAccept', { body: { username: str(p['username']) } });
  },
  async friendDecline(p) {
    return apiFetch('friendsDecline', { body: { username: str(p['username']) } });
  },
  async friendRemove(p) {
    return apiFetch('friendsRemove', { body: { username: str(p['username']) } });
  },
  async send(p) {
    const username = str(p['username']);
    return apiFetch('messagesSend', { params: { username }, body: { text: str(p['text']) } });
  },
  async markRead(p) {
    const username = str(p['username']);
    await apiFetch('messagesRead', { body: { username } });
    useNotificationsStore.getState().markDmRead(username);
  },
});

export const guildAction = runner({
  async create(p) {
    return withDelta(await apiFetch('guildCreate', { body: { name: str(p['name']).trim(), tag: str(p['tag']).trim().toUpperCase() } }));
  },
  async join(p) {
    return apiFetch('guildJoin', { params: { id: str(p['id']) }, body: {} });
  },
  async leave(p) {
    return apiFetch('guildLeave', { params: { id: str(p['id']) }, body: {} });
  },
  async kick(p) {
    return apiFetch('guildKick', { params: { id: str(p['id']) }, body: { playerId: str(p['playerId']) } });
  },
  async promote(p) {
    return apiFetch('guildPromote', { params: { id: str(p['id']) }, body: { playerId: str(p['playerId']) } });
  },
});

export const marketAction = runner({
  async list(p) {
    const buyNow = p['buyNowPrice'];
    const duration = num(p['durationHours']);
    return withDelta(
      await apiFetch('marketplaceList', {
        body: {
          creatureId: str(p['creatureId']),
          startingBid: num(p['startingBid']),
          buyNowPrice: buyNow === null || buyNow === undefined || buyNow === '' ? null : num(buyNow),
          durationHours: duration === 12 || duration === 48 ? duration : 24,
        },
      }),
    );
  },
  async bid(p) {
    return withDelta(await apiFetch('marketplaceBid', { params: { id: str(p['id']) }, body: { amount: num(p['amount']) } }));
  },
  async buyNow(p) {
    return withDelta(await apiFetch('marketplaceBuyNow', { params: { id: str(p['id']) } }));
  },
  async cancel(p) {
    return withDelta(await apiFetch('marketplaceCancel', { params: { id: str(p['id']) } }));
  },
});

export const adminAction = runner({
  async ban(p) {
    await apiFetch('adminBan', { body: { username: str(p['username']).trim().toLowerCase(), reason: str(p['reason']).trim() } });
    toast('success', `Banned ${str(p['username'])}.`);
  },
  async unban(p) {
    const reason = str(p['reason']).trim();
    await apiFetch('adminUnban', { body: { username: str(p['username']).trim().toLowerCase(), ...(reason.length > 0 ? { reason } : {}) } });
    toast('success', `Unbanned ${str(p['username'])}.`);
  },
});
