/**
 * `/play/market/:listingId` (SPEC §20.9.9): the creature, the full bid history, a bid field pre-filled with
 * max(startingBid, currentBid + 50), and Bid / Buy now / (own listing) Cancel. Rate-limit refusals render as the
 * exact remaining-time caption under the buttons.
 */
import { useEffect, useState } from 'react';
import { useLoaderData, useNavigate, useSearchParams } from 'react-router';
import type { listingLoader } from '../app/loaders';
import { formatMoney } from '../app/TopBar';
import { species, speciesName } from '../data/content';
import { useSessionStore } from '../state/session';
import { Button } from '../ui/Button';
import { CreatureSprite } from '../ui/CreatureSprite';
import { EmptyState } from '../ui/EmptyState';
import { TextField } from '../ui/Field';
import { Icon } from '../ui/Icon';
import { Pill } from '../ui/Pill';
import { TypeBadge } from '../ui/TypeBadge';
import { CreatureHistory } from './CreatureHistory';
import l from './layout.module.css';
import s from './ListingDetail.module.css';
import { relativeTime, timeLeft, useIntent } from './shared';

export const BID_STEP = 50;

export function ListingDetail() {
  const { id, listing, missing } = useLoaderData<typeof listingLoader>();
  const me = useSessionStore((st) => st.profile?.id ?? '');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fetcher = useIntent(`/play/market/${id}`);
  const data = listing.available ? listing.data : null;
  const suggested = data === null ? 0 : Math.max(data.startingBid, (data.currentBid ?? 0) + BID_STEP);
  const [amount, setAmount] = useState(String(suggested));
  useEffect(() => setAmount(String(suggested)), [suggested]);

  const back = (): void => void navigate({ pathname: '/play/market', search: params.toString() });
  if (data === null) {
    return (
      <aside className={l.detail}>
        <EmptyState icon="market" tone="unavailable" title={missing ? 'Listing not found' : 'Unavailable'} hint={missing ? 'It may have ended or been cancelled.' : 'The marketplace is not live on this server yet.'} action={<Button onClick={back}>Back to listings</Button>} />
      </aside>
    );
  }
  const sp = species(data.speciesId);
  const own = data.sellerId === me;
  const active = data.status === 'active';
  const bid = Number(amount);
  const bidOk = Number.isFinite(bid) && bid >= suggested && (data.buyNowPrice === null || bid < data.buyNowPrice);
  const error = fetcher.result?.ok === false ? fetcher.result.error.message : null;

  return (
    <aside className={l.detail} data-type={sp?.types[0] ?? 'Normal'} aria-label="Listing">
      <div className={l.rowBetween}>
        <span className={l.sectionTitle}>Listing</span>
        <button type="button" className={s.close} onClick={back} aria-label="Close listing">
          <Icon name="close" size="sm" />
        </button>
      </div>
      <div className={l.detailHead}>
        <CreatureSprite speciesId={data.speciesId} variantKey={data.variantKey} shiny={data.isShiny === true} size="lg" />
        <div className={l.detailTitle}>
          <h3 className={l.h3}>{speciesName(data.speciesId)}</h3>
          <div className={l.row}>
            <span className={l.caption}>Lv {data.level}</span>
            {sp?.types.map((t) => <TypeBadge key={t} type={t} size="sm" />)}
          </div>
          <div className={l.row}>
            {data.variantKey !== 'normal' && <Pill tone="info">{data.variantKey}</Pill>}
            {data.isAlpha && <Pill tone="danger">Alpha</Pill>}
            {data.isShiny === true && <Pill tone="warn">Shiny</Pill>}
            {own && <Pill tone="neutral">Your listing</Pill>}
          </div>
        </div>
      </div>
      <div className={l.kv}>
        <span className={l.kvLabel}>Current bid</span>
        <span />
        <span className={l.kvValue}>{data.currentBid === null ? 'No bids' : formatMoney(data.currentBid)}</span>
        <span className={l.kvLabel}>Starting bid</span>
        <span />
        <span className={l.kvValue}>{formatMoney(data.startingBid)}</span>
        <span className={l.kvLabel}>Buy now</span>
        <span />
        <span className={l.kvValue}>{data.buyNowPrice === null ? '—' : formatMoney(data.buyNowPrice)}</span>
        <span className={l.kvLabel}>Time left</span>
        <span />
        <span className={l.kvValue}>{active ? timeLeft(data.expiresAt) : data.status}</span>
      </div>
      {active && !own && (
        <div className={l.stack}>
          <TextField label="Your bid" type="number" inputMode="numeric" min={suggested} value={amount} onChange={setAmount} hint={`At least ${formatMoney(suggested)}.`} />
          <div className={l.row}>
            <Button variant="primary" disabled={!bidOk} busy={fetcher.busy((p) => p.intent === 'bid')} onClick={() => fetcher.submit({ intent: 'bid', id: data.id, amount: bid })}>
              Bid {Number.isFinite(bid) ? formatMoney(bid) : ''}
            </Button>
            {data.buyNowPrice !== null && (
              <Button busy={fetcher.busy((p) => p.intent === 'buyNow')} onClick={() => fetcher.submit({ intent: 'buyNow', id: data.id })}>
                Buy now {formatMoney(data.buyNowPrice)}
              </Button>
            )}
          </div>
        </div>
      )}
      {active && own && (
        <Button variant="danger" disabled={data.currentBid !== null} busy={fetcher.busy((p) => p.intent === 'cancel')} onClick={() => fetcher.submit({ intent: 'cancel', id: data.id })}>
          {data.currentBid !== null ? 'Has bids — cannot cancel' : 'Cancel listing'}
        </Button>
      )}
      {error !== null && <p className={s.error}>{error}</p>}
      <CreatureHistory creatureId={data.creatureId} title="The creature's history" />
      <section className={l.section}>
        <h4 className={l.sectionTitle}>Bid history</h4>
        {data.bids.length === 0 ? (
          <p className={l.muted}>No bids yet.</p>
        ) : (
          <ol className={s.bids}>
            {[...data.bids]
              .sort((a, b) => b.amount - a.amount)
              .map((b) => (
                <li key={b.id} className={s.bid}>
                  <span className={l.mono}>{formatMoney(b.amount)}</span>
                  <span className={l.caption}>{b.bidderId === me ? 'You' : `Trainer ${b.bidderId.slice(0, 6)}`}</span>
                  <span className={l.caption}>{relativeTime(b.placedAt)}</span>
                </li>
              ))}
          </ol>
        )}
      </section>
    </aside>
  );
}
