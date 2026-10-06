/**
 * §30.8.2 expiry job — every 60 s: `db.transaction(tx => market.closeExpired(tx, now, 100))`, looping until a run
 * closes fewer than 100. `FOR UPDATE SKIP LOCKED` (persist) makes concurrent runs on several processes partition
 * the due rows instead of colliding. A sold listing's buyer gets the dex marks of a market receipt (authority
 * matrix `dex_entries`) and both parties `tradeComplete` trainer exp, in the same transaction as the sale.
 */
import { TRAINER_EXP } from '@ewa/core';
import type { Db, Repos } from '@ewa/persist';
import type { Logger } from '../log';

export const MARKET_EXPIRY_MS = 60_000;
export const MARKET_EXPIRY_BATCH = 100;

export interface MarketExpiryDeps {
  readonly repos: Repos & { readonly db: Db };
  readonly clock: () => number;
  readonly log: Logger;
}

/** One job run: closes every listing due at `now`, in batches. Returns the number closed by THIS worker. */
export async function runMarketExpiry(deps: MarketExpiryDeps, now: Date = new Date(deps.clock()), batch: number = MARKET_EXPIRY_BATCH): Promise<number> {
  const { repos } = deps;
  let total = 0;
  for (let guard = 0; guard < 10_000; guard++) {
    const closed = await repos.db.transaction(async (tx) => {
      const rows = await repos.market.closeExpiredDetailed(tx, now, batch);
      for (const r of rows) {
        if (!r.sold || r.buyerId === null) continue;
        await repos.progress.markSeen(tx, r.buyerId, r.speciesId, now);
        await repos.progress.markCaught(tx, r.buyerId, r.speciesId, r.variantKey, r.isAlpha, now, r.isShiny === true);
        await repos.players.addTrainerExp(tx, r.buyerId, TRAINER_EXP.tradeComplete);
        await repos.players.addTrainerExp(tx, r.sellerId, TRAINER_EXP.tradeComplete);
      }
      return rows.length;
    });
    total += closed;
    if (closed < batch) break;
  }
  return total;
}

/** The 60 s loop started by `boot` (§30.1.1 step 6). A run in flight is never overlapped by the next tick. */
export function startMarketExpiry(deps: MarketExpiryDeps, intervalMs: number = MARKET_EXPIRY_MS): { stop(): void } {
  let running = false;
  const t = setInterval(() => {
    if (running) return;
    running = true;
    runMarketExpiry(deps)
      .then((n) => {
        if (n > 0) deps.log.info({ closed: n }, 'market expiry');
      })
      .catch((e: unknown) => deps.log.error({ err: e }, 'market expiry failed'))
      .finally(() => {
        running = false;
      });
  }, intervalMs);
  t.unref();
  return { stop: () => clearInterval(t) };
}
