/**
 * SPEC §20.2.5: every component in every state, at `/__gallery` in dev builds only (the route is added under
 * `import.meta.env.DEV`). The visual test screenshots this page at 1440p.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { MOVES } from '@ewa/content';
import { TYPE_NAMES } from '@ewa/core';
import type { CreatureInstance, MoveDef } from '@ewa/core';
import { Button } from './Button';
import type { ButtonVariant } from './Button';
import { Card } from './Card';
import { CreatureCard } from './CreatureCard';
import { EmptyState } from './EmptyState';
import { FormError, Segmented, Select, Stepper, TextField } from './Field';
import s from './Gallery.module.css';
import { HpBar } from './HpBar';
import { Modal } from './Modal';
import { MoveButton } from './MoveButton';
import type { Effectiveness } from './MoveButton';
import { Pill } from './Pill';
import { ProgressBar } from './ProgressBar';
import { Skeleton } from './Skeleton';
import { Slider } from './Slider';
import { Table } from './Table';
import { Tabs } from './Tabs';
import { Toast } from './Toast';
import { Toggle } from './Toggle';
import { TypeBadge } from './TypeBadge';

const demo = (speciesId: string, over: Partial<CreatureInstance> = {}): CreatureInstance => ({
  id: `g-${speciesId}`,
  ownerId: null,
  speciesId,
  nickname: null,
  level: 24,
  exp: 0,
  hp: 40,
  moves: [{ id: 'Tackle', pp: 30, ppMax: 35 }],
  status: [],
  ability: '',
  heldItem: null,
  variantKey: 'normal',
  isAlpha: false,
  caughtAt: null,
  ribbons: [],
  favorite: false,
  locked: false,
  ...over,
});

const VARIANTS: readonly ButtonVariant[] = ['primary', 'secondary', 'ghost', 'danger'];
const EFFS: readonly (Effectiveness | null)[] = [4, 2, null, 0.5, 0.25, 0];

function Section({ title, children }: { readonly title: string; readonly children: ReactNode }) {
  return (
    <section className={s.section}>
      <h2 className={s.h2}>{title}</h2>
      <div className={s.body}>{children}</div>
    </section>
  );
}

export function Gallery() {
  const [tab, setTab] = useState<'a' | 'b' | 'c'>('a');
  const [on, setOn] = useState(true);
  const [vol, setVol] = useState(0.6);
  const [qty, setQty] = useState(3);
  const [seg, setSeg] = useState<'system' | 'on' | 'off'>('system');
  const [modal, setModal] = useState(false);
  const moves = MOVES.slice(0, 6) as readonly MoveDef[];
  return (
    <div className={s.page} data-testid="gallery">
      <h1 className={s.h1}>Component gallery</h1>
      <Section title="Button — variants × sizes, disabled, busy, pressed">
        {VARIANTS.map((v) => (
          <div key={v} className={s.row}>
            <Button variant={v} size="sm">
              {v} sm
            </Button>
            <Button variant={v}>{v} md</Button>
            <Button variant={v} size="lg" icon="check">
              {v} lg
            </Button>
            <Button variant={v} disabled>
              disabled
            </Button>
            <Button variant={v} busy>
              busy
            </Button>
          </div>
        ))}
        <div className={s.row}>
          <Button pressed>pressed toggle</Button>
        </div>
      </Section>
      <Section title="Card — default, interactive, selected">
        <div className={s.row}>
          <Card>Default card</Card>
          <Card interactive onClick={() => undefined}>
            Interactive card
          </Card>
          <Card interactive selected onClick={() => undefined}>
            Selected card
          </Card>
        </div>
      </Section>
      <Section title="Tabs">
        <Tabs
          tabs={[
            { key: 'a', label: 'Friends', count: 3 },
            { key: 'b', label: 'Requests' },
            { key: 'c', label: 'Nearby', count: 12 },
          ]}
          value={tab}
          onChange={setTab}
        />
      </Section>
      <Section title="TypeBadge — all 19 (md, sm, compact)">
        <div className={s.wrap}>
          {TYPE_NAMES.map((t) => (
            <TypeBadge key={t} type={t} />
          ))}
        </div>
        <div className={s.wrap}>
          {TYPE_NAMES.map((t) => (
            <TypeBadge key={t} type={t} size="sm" compact />
          ))}
        </div>
      </Section>
      <Section title="HpBar — > 50 %, 20–50 %, < 20 %, statuses">
        <div className={s.grid3}>
          <HpBar hp={80} maxHp={100} showNumbers />
          <HpBar hp={35} maxHp={100} showNumbers status={['poison']} />
          <HpBar hp={9} maxHp={100} showNumbers status={['burn', 'confuse']} />
        </div>
      </Section>
      <Section title="MoveButton — effectiveness chevrons, low PP, empty, disabled, static">
        <div className={s.grid3}>
          {moves.map((m, i) => (
            <MoveButton key={m.id} move={m} pp={i === 4 ? 2 : i === 5 ? 0 : m.pp} ppMax={m.pp} effectiveness={EFFS[i] ?? null} hotkey={i < 4 ? (String(i + 1) as '1') : undefined} onClick={() => undefined} disabled={i === 5} />
          ))}
          {moves[0] !== undefined && <MoveButton move={moves[0]} pp={10} ppMax={35} />}
        </div>
      </Section>
      <Section title="CreatureCard — row, tile, showcase; selected; badges">
        <div className={s.grid2}>
          <CreatureCard creature={demo('bramblecub', { favorite: true, heldItem: 'Choice Band' })} onClick={() => undefined} />
          <CreatureCard creature={demo('glimfin', { locked: true, isAlpha: true, status: ['sleep'] })} selected onClick={() => undefined} />
        </div>
        <div className={s.row}>
          <CreatureCard creature={demo('cindercap')} variant="tile" onClick={() => undefined} />
          <CreatureCard creature={demo('glimfin', { favorite: true })} variant="tile" selected onClick={() => undefined} />
          <CreatureCard creature={demo('bramblecub')} variant="showcase" caption="A starter from Mirevale." onClick={() => undefined} />
          <CreatureCard creature={demo('cindercap')} variant="showcase" selected caption="Selected showcase." onClick={() => undefined} />
        </div>
      </Section>
      <Section title="Slider, Toggle, Segmented, Stepper">
        <div className={s.grid2}>
          <Slider label="Music" value={vol} min={0} max={1} step={0.05} format={(v) => `${Math.round(v * 100)} %`} onChange={setVol} />
          <Slider label="Disabled" value={0.3} min={0} max={1} step={0.1} onChange={() => undefined} disabled />
          <Toggle label="Camera shake" description="On state" checked={on} onChange={setOn} />
          <Toggle label="Hitstop" description="Off: reduced motion" checked={false} onChange={() => undefined} disabled />
          <Segmented
            label="Reduced motion"
            value={seg}
            options={[
              { value: 'system', label: 'System' },
              { value: 'on', label: 'On' },
              { value: 'off', label: 'Off' },
            ]}
            onChange={setSeg}
          />
          <Stepper label="Quantity" value={qty} min={1} max={99} onChange={setQty} />
        </div>
      </Section>
      <Section title="Fields — default, error, counter, select">
        <div className={s.grid3}>
          <TextField label="Username" placeholder="trainer_name" />
          <TextField label="Email" value="not-an-email" onChange={() => undefined} error="Enter a valid email address." />
          <TextField label="Message" value={'x'.repeat(262)} onChange={() => undefined} maxLength={300} counterFrom={250} />
          <Select
            label="Sort"
            value="level"
            options={[
              { value: 'level', label: 'Level' },
              { value: 'dex', label: 'Dex number' },
            ]}
            onChange={() => undefined}
          />
        </div>
        <FormError>Cannot reach the server. Check that it is running and try again.</FormError>
      </Section>
      <Section title="Table — rows, sort, selected, empty">
        <Table<{ id: string; name: string; qty: number }>
          columns={[
            { key: 'name', header: 'Item', render: (r) => r.name, sortValue: (r) => r.name },
            { key: 'qty', header: 'Qty', align: 'end', width: 90, render: (r) => r.qty, sortValue: (r) => r.qty },
          ]}
          rows={[
            { id: '1', name: 'Potion', qty: 8 },
            { id: '2', name: 'Spark Orb', qty: 13 },
          ]}
          rowKey={(r) => r.id}
          sort={{ key: 'qty', dir: 'desc' }}
          onSort={() => undefined}
          selectedKey="2"
          onRowClick={() => undefined}
          empty={null}
        />
        <Table columns={[{ key: 'a', header: 'Empty table', render: () => null }]} rows={[]} rowKey={() => ''} empty={<EmptyState icon="bag" title="Nothing to sell" hint="Goods you carry show up here." />} />
      </Section>
      <Section title="Toast — four levels">
        <div className={s.col}>
          <Toast id="1" level="info" text="Challenge sent to rival." ttlMs={0} onDismiss={() => undefined} />
          <Toast id="2" level="success" text="Bought 2 × Potion." ttlMs={0} onDismiss={() => undefined} />
          <Toast id="3" level="warn" text="Finish the battle first." ttlMs={0} onDismiss={() => undefined} />
          <Toast id="4" level="danger" text="Not enough money." ttlMs={0} onDismiss={() => undefined} />
        </div>
      </Section>
      <Section title="Pill, ProgressBar, Skeleton, EmptyState, Modal">
        <div className={s.row}>
          <Pill>neutral</Pill>
          <Pill tone="accent">3</Pill>
          <Pill tone="warn">In battle</Pill>
          <Pill tone="danger">Alpha</Pill>
          <Pill tone="info">dusk</Pill>
        </div>
        <ProgressBar value={0.3} secondary={0.55} label="Dex" size="lg" />
        <div className={s.grid2}>
          <Skeleton shape="rows" count={2} />
          <Skeleton shape="tiles" count={8} />
        </div>
        <div className={s.grid2}>
          <EmptyState icon="box" title="Your box is empty" hint="Creatures you catch with a full party arrive here." />
          <EmptyState icon="market" tone="unavailable" title="The marketplace — not live yet" hint="Arrives with the next server update." />
        </div>
        <Button onClick={() => setModal(true)}>Open modal</Button>
        <Modal open={modal} title="Release Mossy?" size="sm" onClose={() => setModal(false)} footer={<Button variant="danger" onClick={() => setModal(false)}>Release</Button>}>
          It returns to the wild.
        </Modal>
      </Section>
    </div>
  );
}

export default Gallery;
