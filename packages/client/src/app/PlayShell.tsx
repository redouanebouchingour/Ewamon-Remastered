/**
 * `/play`'s element — the PanelHost half of PlayShell (SPEC §20.1.1: PlayShell = CanvasHost + PanelHost). It owns
 * the DOM chrome over the live world: the top bar, the anchored right panel slot for /play/* children, the battle
 * overlay, the connection overlay and toasts. The canvas is NOT here (CanvasHost, the pathless parent, owns it),
 * so this element and its errorElement can come and go without touching the world.
 */
import { useEffect, useState } from 'react';
import { Outlet, useLoaderData, useLocation, useNavigate, useNavigation } from 'react-router';
import type { ZoneId } from '@ewa/protocol';
import { BattleOverlay } from '../battle/BattleOverlay';
import { ChallengePrompt } from '../world/ChallengePrompt';
import { ChatInput } from '../world/ChatInput';
import { DialogueBox } from '../world/DialogueBox';
import { EvolutionBanner } from '../world/EvolutionBanner';
import { FishingPrompt } from '../world/FishingPrompt';
import { Minimap } from '../world/Minimap';
import { PostBattlePrompts } from '../world/PostBattlePrompts';
import { RaidLobby } from '../world/RaidLobby';
import { TowerModal, TowerStreak } from '../world/TowerModal';
import { TradeModal } from '../world/TradeModal';
import { BandTutorialCard } from '../world/BandTutorialCard';
import { TutorialCard } from '../world/TutorialCard';
import { setNavigator } from './navigation';
import { installMessageRouter } from '../net/messageRouter';
import { getWorldSession } from '../net/WorldSession';
import { worldCapability } from '../scene/worldHost';
import { useSettingsStore } from '../state/settings';
import type { InputAction } from '../state/settings';
import { useUiStore } from '../state/ui';
import { Panel } from '../ui/Panel';
import { Skeleton } from '../ui/Skeleton';
import { ConnectionOverlay } from './ConnectionOverlay';
import type { playLoader } from './loaders';
import { NotificationHost } from './NotificationHost';
import s from './PlayShell.module.css';
import { NAV, TopBar, keyLabel } from './TopBar';

/** Joins the world once per session (idempotent) and routes DOM-side server messages into the stores. */
function useWorldConnection(zoneId: ZoneId): void {
  useEffect(() => {
    const ws = getWorldSession();
    const off = installMessageRouter(ws);
    ws.enter(zoneId).catch(() => undefined); // the session toasts + flips ui.connection itself
    return off;
  }, [zoneId]);
}

const SHORTCUTS: Partial<Record<InputAction, string>> = {
  party: '/play/party',
  // Phase C5: the Bag screen (field items, potions, Rare Candy, held items)
  bag: '/play/bag',
  journal: '/play/dex',
  map: '/play/map',
};

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
}

/**
 * DOM-level menu shortcuts (§20.4.5 party / journal / pause; F1 HUD). Part 2's LocalPlayerController owns movement
 * and interaction keys; these only open panels and never fire while typing, in a modal or in a battle.
 */
function useShellHotkeys(): void {
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    setNavigator((to) => void navigate(to));
    return () => setNavigator(null);
  }, [navigate]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey || isTyping(e.target)) return;
      const ui = useUiStore.getState();
      if (ui.battle !== null || ui.evolution !== null || ui.modal !== 'none' || ui.dialogue !== null || ui.chatOpen || document.querySelector('[aria-modal="true"]') !== null) return;
      const binds = useSettingsStore.getState().keybinds;
      if (binds.toggleHud.includes(e.code)) {
        e.preventDefault();
        ui.toggleHud();
        return;
      }
      if (binds.pause.includes(e.code) && location.pathname === '/play') {
        void navigate('/play/settings');
        return;
      }
      for (const [action, to] of Object.entries(SHORTCUTS) as [InputAction, string][]) {
        if (binds[action].includes(e.code)) {
          e.preventDefault();
          void navigate(location.pathname === to ? '/play' : to);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navigate, location.pathname]);
}

/**
 * §20.1.3 / §20.9.13: a /play/* loader slower than 400 ms shows the target panel's skeleton (never a spinner, never
 * over the canvas); faster ones just swap. Only for navigation to a different panel.
 */
function usePendingPanel(): string | null {
  const navigation = useNavigation();
  const location = useLocation();
  const target = navigation.state === 'loading' ? navigation.location.pathname : null;
  const pending = target !== null && target.startsWith('/play/') && target.split('/')[2] !== location.pathname.split('/')[2] ? target : null;
  const [late, setLate] = useState<string | null>(null);
  useEffect(() => {
    if (pending === null) {
      setLate(null);
      return;
    }
    const t = setTimeout(() => setLate(pending), 400);
    return () => clearTimeout(t);
  }, [pending]);
  return late !== null && late === pending ? pending : null;
}

function PanelSkeleton({ path }: { readonly path: string }) {
  const nav = NAV.find((n) => path.startsWith(n.to));
  const shape = path.startsWith('/play/dex') || path.startsWith('/play/box') ? 'tiles' : path.startsWith('/play/pass') ? 'track' : 'table';
  return (
    <div className={s.skeletonSlot}>
      <Panel title={nav?.label ?? 'Loading'} eyebrow="Loading">
        <Skeleton shape={shape} />
      </Panel>
    </div>
  );
}

/** The key legend over the bare world (Broadcast: a black strip of paper key chips, bottom-centre). */
function WorldHint() {
  const binds = useSettingsStore((st) => st.keybinds);
  const keys: readonly (readonly [InputAction, string])[] = [
    ['party', 'Party'],
    ['bag', 'Bag'],
    ['journal', 'Dex'],
    ['map', 'Map'],
    ['pause', 'Settings'],
  ];
  return (
    <aside className={s.hint} aria-label="Shortcuts">
      {keys.map(([action, label]) => (
        <span key={action}>
          <kbd>{keyLabel(binds[action][0])}</kbd> {label}
        </span>
      ))}
    </aside>
  );
}

export function PlayShell() {
  const { zoneId } = useLoaderData<typeof playLoader>();
  const location = useLocation();
  const hudVisible = useUiStore((st) => st.hudVisible);
  // the evolution sequence has the stage: the open panel and the shortcut hint step aside until it ends (§20.5.6)
  const evolving = useUiStore((st) => st.evolution !== null);
  const inBattle = useUiStore((st) => st.battle !== null);
  useWorldConnection(zoneId as ZoneId);
  useShellHotkeys();
  const pendingPanel = usePendingPanel();
  const hasPanel = location.pathname !== '/play' && location.pathname !== '/play/';
  return (
    <div className={s.shell} data-testid="playshell" data-hud={hudVisible ? 'on' : 'off'} data-evolving={evolving || undefined}>
      <TopBar />
      <div className={s.panelSlot} data-open={hasPanel || pendingPanel !== null || undefined}>
        {pendingPanel !== null ? <PanelSkeleton path={pendingPanel} /> : <Outlet />}
      </div>
      {!hasPanel && <WorldHint />}
      {/* Phase C3: the minimap draws over the live world only (no world → no canvas, as GameCanvas) */}
      {!hasPanel && !inBattle && worldCapability() && <Minimap />}
      {/* Phase D12: Prof. Wynn's tutorial steps (live world only, like the minimap) */}
      {worldCapability() && <TutorialCard />}
      {/* Majin / Tenjin: the band cards (once a band is in the inventory), state apart from the opening tutorial */}
      {worldCapability() && <BandTutorialCard />}
      <DialogueBox />
      <FishingPrompt />
      <ChatInput />
      <BattleOverlay />
      <ChallengePrompt />
      <TradeModal />
      <RaidLobby />
      {/* Phase D14: the battle tower (picker / between fights / summary) and the counter over a tower fight */}
      <TowerModal />
      <TowerStreak />
      <PostBattlePrompts />
      <EvolutionBanner />
      <ConnectionOverlay />
      <NotificationHost />
    </div>
  );
}
