// @vitest-environment jsdom
/**
 * Shop haggling on the shop screen: a deal in force shows as the strip ("Hessa's deal: 15% off for 10 minutes") with
 * the prices under it; Haggle opens the keeper's talk beside the panel (typed at once); a bulk offer makes the keeper
 * grant the server's cap, the tool pass's give_discount goes to POST /shop/haggle, and the prices on the open screen
 * move as the deal lands, with a toast. A markup shows in the warn tone. No keeper, no Haggle.
 */
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { RouterProvider, createMemoryRouter } from 'react-router';
import type { HaggleDeal, HaggleKeeper } from '@ewa/protocol';
import { dealBuyPrice } from '@ewa/protocol';
import type { ShopData } from '../src/app/loaders';
import { formatMoney } from '../src/app/TopBar';
import { endTalk } from '../src/state/npcTalk';
import { resetHaggle, setShopHaggle, useHaggleStore } from '../src/state/haggle';
import { useNotificationsStore } from '../src/state/notifications';
import { useSessionStore } from '../src/state/session';
import { useUiStore } from '../src/state/ui';
import { ShopScreen } from '../src/screens/ShopScreen';
import { DialogueBox } from '../src/world/DialogueBox';

beforeAll(() => {
  try {
    new Request('http://localhost/', { signal: new AbortController().signal });
  } catch (_e) {
    const Native = globalThis.Request;
    class PatchedRequest extends Native {
      constructor(input: RequestInfo | URL, init: RequestInit = {}) {
        const { signal, ...rest } = init;
        super(input, rest);
        Object.defineProperty(this, 'signal', { value: signal ?? new AbortController().signal });
      }
    }
    globalThis.Request = PatchedRequest as typeof Request;
  }
});

const KEEPER = 'mirevale.shop.keeper';
const keeper: HaggleKeeper = { npcId: KEEPER, npcName: 'Hessa', cap: 20, feeling: 'liked', readyAt: null };
const in10 = (): string => new Date(Date.now() + 10 * 60_000 - 1_000).toISOString();
const deal = (kind: HaggleDeal['kind'], percent: number): HaggleDeal => ({ npcId: KEEPER, npcName: 'Hessa', zoneId: 'mirevale', kind, percent, expiresAt: in10() });
const DATA: ShopData = { kind: 'ok', zoneId: 'mirevale', stock: ['potion', 'superpotion'], prices: { potion: 300, superpotion: 700 }, haggle: true };

interface Call {
  readonly url: string;
  readonly body: Record<string, unknown> | null;
}

const REPLY = 'Twenty Potions? Fine, twenty percent off for the next ten minutes.';

function mockFetch(calls: Call[]): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      const body = typeof init.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : null;
      calls.push({ url, body });
      if (url.endsWith('/shop/haggle')) return Response.json({ deal: deal('discount', 20), granted: 20, keeper: { ...keeper, cap: 10, readyAt: in10() } });
      if (body?.['stream'] === true) return new Response(`data: {"choices":[{"delta":{"content":${JSON.stringify(REPLY)}}}]}\n\ndata: [DONE]\n\n`, { status: 200 });
      if (body?.['tools'] !== undefined) return Response.json({ choices: [{ message: { tool_calls: [{ function: { name: 'give_discount', arguments: '{"percent": 20}' } }] } }] });
      return Response.json({ choices: [{ message: { content: 'The traveller haggled with me.' } }] });
    }),
  );
}

function renderShop(data: ShopData = DATA): void {
  const router = createMemoryRouter(
    [
      {
        path: '/play/shop',
        loader: () => data,
        action: () => null,
        element: (
          <>
            <ShopScreen />
            <DialogueBox />
          </>
        ),
      },
      { path: '/play', element: <p>world</p> },
    ],
    { initialEntries: ['/play/shop'] },
  );
  render(<RouterProvider router={router} />);
}

const flush = async (ms = 60): Promise<void> => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, ms));
  });
};

const priceCell = (item: string): HTMLElement => {
  const row = screen.getByText(item, { selector: 'span' }).closest('tr')!;
  return within(row).getAllByRole('cell')[2]!;
};

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
beforeEach(() => {
  useUiStore.getState().reset();
  endTalk();
  resetHaggle();
  useSessionStore.setState({ accessToken: null });
  useNotificationsStore.setState({ toasts: [] } as never);
});

describe('ShopScreen haggling', () => {
  it('shows the deal in force and the prices under it', async () => {
    setShopHaggle('mirevale', deal('discount', 15), keeper, []);
    renderShop();
    await flush();
    expect(screen.getByTestId('shop-deal').textContent).toBe("DealHessa's deal: 15% off for 10 minutes");
    const cell = priceCell('Potion');
    expect(cell.textContent).toBe(`${formatMoney(300)}${formatMoney(dealBuyPrice(300, { kind: 'discount', percent: 15 }))}`);
    expect(cell.querySelector('s')?.textContent).toBe(formatMoney(300));
  });

  it('Haggle opens the keeper talk; the granted deal lands on the open screen', async () => {
    const calls: Call[] = [];
    mockFetch(calls);
    setShopHaggle('mirevale', null, keeper, [{ name: 'Potion', price: 300 }]);
    renderShop();
    await flush();
    expect(screen.queryByTestId('shop-deal')).toBeNull();
    expect(priceCell('Potion').textContent).toBe(formatMoney(300));

    fireEvent.click(screen.getByRole('button', { name: 'Haggle' }));
    await flush();
    const box = screen.getByTestId('dialoguebox');
    expect(box.getAttribute('data-side')).toBe('left');
    expect(box.textContent).toContain('Hessa, Shopkeeper');
    expect(screen.getByRole('button', { name: 'Haggle' })).toHaveProperty('disabled', true);
    // typed at once
    const input = screen.getByRole('textbox');
    fireEvent.change(input, { target: { value: "I'd like to buy twenty Potions. Can you do me a better price?" } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
      await new Promise((r) => setTimeout(r, 120));
    });
    await flush(120);

    const talk = calls.find((c) => c.body?.['stream'] === true)!;
    const msgs = talk.body!['messages'] as { content: string }[];
    expect(msgs[0]!.content).toContain('You are Hessa, the shopkeeper');
    expect(msgs[0]!.content).toContain('Potion for 300 coins');
    expect(msgs.at(-1)!.content).toContain('[They will buy a lot, so you give in: say you give them twenty percent off your prices for the next ten minutes.]');
    expect(calls.find((c) => c.url.endsWith('/shop/haggle'))?.body).toEqual({ npcId: KEEPER, kind: 'discount', percent: 20 });

    expect(screen.getByTestId('shop-deal').textContent).toContain("Hessa's deal: 20% off for 10 minutes");
    expect(priceCell('Potion').textContent).toContain(formatMoney(240));
    expect(JSON.stringify(useNotificationsStore.getState().toasts)).toContain("Hessa's deal: 20% off");
    expect(useHaggleStore.getState().keeper?.cap).toBe(10);
  });

  it('a markup shows in the warn tone with the prices up; no keeper, no Haggle', async () => {
    setShopHaggle('mirevale', deal('markup', 10), keeper, []);
    renderShop();
    await flush();
    const strip = screen.getByTestId('shop-deal');
    expect(strip.getAttribute('data-kind')).toBe('markup');
    expect(strip.textContent).toContain("Hessa's prices: 10% up");
    expect(priceCell('Potion').textContent).toContain(formatMoney(330));
    cleanup();
    resetHaggle();
    renderShop({ ...DATA, haggle: false });
    await flush();
    expect(screen.queryByRole('button', { name: 'Haggle' })).toBeNull();
  });
});
