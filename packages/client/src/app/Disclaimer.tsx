/**
 * First-visit disclaimer (2026-10-27): a full-page notice shown once per browser, before the app. The acknowledgement
 * lives in localStorage; when storage is blocked it lasts the session. Automated browsers (CDP harnesses, headless
 * walks) skip it so they drive the real app unchanged.
 */
import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../ui/Button';
import { KeyArt } from '../ui/KeyArt';
import s from './Disclaimer.module.css';

const KEY = 'ewa.disclaimer.v1';

function acknowledged(): boolean {
  if (typeof navigator !== 'undefined' && navigator.webdriver) return true;
  try {
    return typeof localStorage === 'undefined' || localStorage.getItem(KEY) !== null;
  } catch (_e) {
    return false;
  }
}

export function Disclaimer({ onContinue }: { readonly onContinue: () => void }) {
  return (
    <div className={s.page} role="dialog" aria-modal="true" aria-labelledby="disclaimer-title" data-testid="disclaimer">
      <KeyArt dim />
      <div className={s.card}>
        <h1 id="disclaimer-title" className={s.title}>
          Before you continue
        </h1>
        <p className={s.text}>Ewamon Remastered is a school project. It is a non-commercial parody and falls under fair use.</p>
        <p className={s.text}>No money is or will be made from this project: there are no purchases, ads or paid features.</p>
        <p className={s.text}>By continuing you acknowledge this.</p>
        <Button variant="primary" size="lg" onClick={onContinue} className={s.button}>
          I understand, continue
        </Button>
      </div>
    </div>
  );
}

export function DisclaimerGate({ children }: { readonly children: ReactNode }) {
  const [ok, setOk] = useState(acknowledged);
  if (ok) return <>{children}</>;
  return (
    <Disclaimer
      onContinue={() => {
        try {
          localStorage.setItem(KEY, new Date().toISOString());
        } catch (_e) {
          // storage blocked: the acknowledgement lasts this session
        }
        setOk(true);
      }}
    />
  );
}
