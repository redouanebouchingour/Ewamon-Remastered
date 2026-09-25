/**
 * The trade modal (SPEC §20.3.1 `ui.trade`, §30.8.3; wired to the protocol's trade* messages):
 *   requested — the target sees Accept / Decline (`tradeReply`), the requester waits (Cancel = `tradeCancel`);
 *   open / confirming — pick ≤ 6 of your creatures + money (`tradeOffer`), see the other offer, `tradeConfirm` with the
 *   current `offerHash` (any change to either offer resets both confirmations server-side);
 *   complete / cancelled — the router toasts and clears `ui.trade`; the rows arrive as `inventoryDelta`.
 * `useBlocker` holds navigation while a trade is open / confirming (§20.1.3 (b), the second sanctioned blocker).
 * The other player's creatures are known only by id on the wire, so their side shows counts and money.
 * Settings › Social `allowTrades: false` declines incoming requests automatically.
 */
import { useEffect, useMemo, useState } from 'react';
import { useBlocker } from 'react-router';
import { useShallow } from 'zustand/react/shallow';
import { getWorldSession } from '../net/WorldSession';
import { useRoomState } from '../net/useRoomState';
import { toast } from '../state/notifications';
import { useSessionStore } from '../state/session';
import { useSettingsStore } from '../state/settings';
import { useUiStore } from '../state/ui';
import { Button } from '../ui/Button';
import { CreatureCard } from '../ui/CreatureCard';
import { Modal } from '../ui/Modal';
import s from './WorldModals.module.css';

function TradeBlocker() {
  const blocker = useBlocker(({ currentLocation, nextLocation }) => currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state === 'blocked') {
      toast('warn', 'Finish or cancel the trade first.');
      blocker.reset();
    }
  }, [blocker]);
  return null;
}

const NONE: readonly string[] = [];

export function TradeModal() {
  const trade = useUiStore((st) => st.trade);
  const allow = useSettingsStore((st) => st.social.allowTrades);
  const selfId = useSessionStore((st) => st.profile?.id ?? '');
  const money = useSessionStore((st) => st.inventory?.money ?? 0);
  const mine = useSessionStore(useShallow((st) => [...(st.inventory?.party ?? []), ...(st.inventory?.box ?? [])]));
  const otherId = trade === null ? '' : trade.offers[0].playerId === selfId ? trade.offers[1].playerId : trade.offers[0].playerId;
  const otherName = useRoomState((st) => st.players.get(otherId)?.name ?? 'the other trainer', 'the other trainer');
  const myIndex = trade !== null && trade.offers[1].playerId === selfId ? 1 : 0;
  const myOffer = trade?.offers[myIndex] ?? null;
  const theirOffer = trade?.offers[1 - myIndex] ?? null;
  const [picked, setPicked] = useState<readonly string[]>(NONE);
  const [cash, setCash] = useState('0');

  // keep the local selection in step with what the server holds for us
  const serverPick = useMemo(() => myOffer?.creatureIds ?? NONE, [myOffer]);
  useEffect(() => {
    setPicked(serverPick);
    setCash(String(myOffer?.money ?? 0));
  }, [serverPick, myOffer?.money]);

  useEffect(() => {
    if (trade !== null && trade.phase === 'requested' && myIndex === 1 && !allow) {
      getWorldSession().send('tradeReply', { tradeId: trade.tradeId, accept: false });
    }
  }, [trade, myIndex, allow]);

  if (trade === null || (trade.phase === 'requested' && myIndex === 1 && !allow)) return null;
  const ws = getWorldSession();
  const cancel = (): void => ws.send('tradeCancel', { tradeId: trade.tradeId });
  const open = trade.phase === 'open' || trade.phase === 'confirming';

  if (trade.phase === 'requested') {
    const incoming = myIndex === 1;
    return (
      <Modal
        open
        size="sm"
        title={incoming ? 'Trade request' : 'Trade requested'}
        onClose={() => (incoming ? ws.send('tradeReply', { tradeId: trade.tradeId, accept: false }) : cancel())}
        footer={
          incoming ? (
            <>
              <Button variant="ghost" onClick={() => ws.send('tradeReply', { tradeId: trade.tradeId, accept: false })}>
                Decline
              </Button>
              <Button variant="primary" icon="trade" onClick={() => ws.send('tradeReply', { tradeId: trade.tradeId, accept: true })}>
                Accept
              </Button>
            </>
          ) : (
            <Button variant="ghost" onClick={cancel}>
              Cancel
            </Button>
          )
        }
      >
        <p className={s.text} data-testid="trademodal">
          {incoming ? (
            <>
              <strong className={s.name}>{otherName}</strong> wants to trade with you.
            </>
          ) : (
            <>
              Waiting for <strong className={s.name}>{otherName}</strong> to accept{'…'}
            </>
          )}
        </p>
      </Modal>
    );
  }

  const cashN = Math.max(0, Math.min(money, Math.floor(Number(cash) || 0)));
  const dirty = picked.join(',') !== serverPick.join(',') || cashN !== (myOffer?.money ?? 0);
  const toggle = (id: string): void => {
    setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : cur.length >= 6 ? cur : [...cur, id]));
  };
  const tradable = mine.filter((c) => !c.locked);
  return (
    <Modal
      open
      size="lg"
      title={`Trade with ${otherName}`}
      onClose={cancel}
      footer={
        <>
          <Button variant="ghost" onClick={cancel}>
            Cancel trade
          </Button>
          <Button variant="secondary" disabled={!dirty} onClick={() => ws.send('tradeOffer', { tradeId: trade.tradeId, creatureIds: [...picked], money: cashN })}>
            Update offer
          </Button>
          <Button
            variant="primary"
            icon="check"
            disabled={dirty || (myOffer?.confirmed ?? false)}
            onClick={() => ws.send('tradeConfirm', { tradeId: trade.tradeId, offerHash: trade.offerHash })}
          >
            {myOffer?.confirmed ? 'Confirmed' : 'Confirm'}
          </Button>
        </>
      }
    >
      {open && <TradeBlocker />}
      <div className={s.columns} data-testid="trademodal">
        <section className={s.column} aria-label="Your offer">
          <h3 className={s.heading}>Your offer</h3>
          <div className={s.pick} role="list">
            {tradable.map((c) => (
              <div key={c.id} role="listitem">
                <CreatureCard creature={c} variant="row" selected={picked.includes(c.id)} onClick={() => toggle(c.id)} />
              </div>
            ))}
          </div>
          <label className={s.money}>
            Money
            <input className={s.moneyInput} inputMode="numeric" value={cash} onChange={(e) => setCash(e.target.value.replace(/[^0-9]/g, ''))} aria-label="Money to offer" />
          </label>
          {myOffer?.confirmed === true && <p className={s.confirmed}>You confirmed</p>}
        </section>
        <section className={s.column} aria-label={`${otherName}'s offer`}>
          <h3 className={s.heading}>{otherName}</h3>
          <div className={s.offer}>
            <p className={s.text}>
              {theirOffer === null || theirOffer.creatureIds.length === 0 ? 'No creatures yet' : `${theirOffer.creatureIds.length} creature${theirOffer.creatureIds.length === 1 ? '' : 's'}`}
            </p>
            <p className={s.caption}>{(theirOffer?.money ?? 0).toLocaleString()} money</p>
            {theirOffer?.confirmed === true && <p className={s.confirmed}>Confirmed</p>}
          </div>
          <p className={s.caption}>Both sides confirm the same offers to complete. Any change resets both confirmations.</p>
        </section>
      </div>
    </Modal>
  );
}
