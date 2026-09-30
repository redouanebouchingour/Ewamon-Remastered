/**
 * The pathless layout route above `/play` (SPEC §20.1.1): it owns the canvas and nothing else. No loader, no
 * errorElement — so /play's loader errors, child errors and the BootScreen all render *inside* its Outlet while
 * the canvas stays mounted (§20.0 rule 1). It unmounts only when the URL leaves /play (logout, 401 → /login),
 * which is also when the world connection is closed.
 */
import { useEffect } from 'react';
import { Outlet } from 'react-router';
import { getWorldSession } from '../net/WorldSession';
import { GameCanvas } from '../scene/GameCanvas';
import { worldCapability } from '../scene/worldHost';
import { KeyArt } from '../ui/KeyArt';
import s from './CanvasHost.module.css';
import { BackgroundCompile, WorldBoot } from './WorldBoot';

let leaveTimer: ReturnType<typeof setTimeout> | null = null;

export function CanvasHost() {
  useEffect(() => {
    if (leaveTimer !== null) {
      clearTimeout(leaveTimer);
      leaveTimer = null;
    }
    return () => {
      // deferred like releaseWorld, so StrictMode's synthetic remount does not drop the connection
      leaveTimer = setTimeout(() => {
        leaveTimer = null;
        void getWorldSession().leave();
      }, 0);
    };
  }, []);

  return (
    <div className={s.host} data-testid="canvashost">
      <div className={s.world}>
        {/* backdrop under the canvas until the renderer draws its first frame (part 2) */}
        <KeyArt dim className={s.backdrop} />
        <GameCanvas />
        {worldCapability() && <WorldBoot />}
        {worldCapability() && <BackgroundCompile />}
      </div>
      <div className={s.chrome}>
        <Outlet />
      </div>
    </div>
  );
}
