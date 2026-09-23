/**
 * Entry (SPEC §20.1.1): one createBrowserRouter, mounted with <RouterProvider> under createRoot(#root).
 * Order: design-system CSS → settings mirrored onto :root (reduced motion, colourblind, UI scale) before the first
 * paint → router → session keeper (access-token refresh + cross-tab logout).
 */
import './ui/fonts.css';
import './ui/tokens.css';
import './ui/global.css';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router';
import { createAppRouter } from './app/router';
import { ViewportGate } from './app/UnsupportedViewport';
import { startSessionKeeper } from './net/sessionKeeper';
import { startApplySettings } from './state/applySettings';

startApplySettings();
const router = createAppRouter();
startSessionKeeper({
  onLoggedOut: () => {
    if (window.location.pathname.startsWith('/play') || window.location.pathname.startsWith('/admin')) void router.navigate('/login', { replace: true });
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ViewportGate>
      <RouterProvider router={router} />
    </ViewportGate>
  </StrictMode>,
);
