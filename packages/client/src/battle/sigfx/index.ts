/** The effect layer of each signature cinematic (signatures.ts `fx`). */
import type { ReactElement } from 'react';
import type { SignatureFx } from '../signatures';
import { AuroraFx } from './Aurora';
import { BankaiFx } from './Bankai';
import { ConvergenceFx } from './Convergence';
import { CrescentFx } from './Crescent';
import { DevourFx } from './Devour';
import { FoxfireFx } from './Foxfire';
import { GraceFx } from './Grace';
import { KamehamehaFx } from './Kamehameha';
import { LotusFx } from './Lotus';
import { MiracleFx } from './Miracle';
import { PyreFx } from './Pyre';
import { RiftFx } from './Rift';
import { SunbreakerFx } from './Sunbreaker';
import { VolleyFx } from './Volley';
import type { FxProps } from './kit';

export const SIG_FX: Readonly<Record<SignatureFx, (p: FxProps) => ReactElement>> = {
  crescent: CrescentFx,
  volley: VolleyFx,
  pyre: PyreFx,
  grace: GraceFx,
  sunbreaker: SunbreakerFx,
  foxfire: FoxfireFx,
  kamehameha: KamehamehaFx,
  miracle: MiracleFx,
  devour: DevourFx,
  bankai: BankaiFx,
  rift: RiftFx,
  aurora: AuroraFx,
  lotus: LotusFx,
  convergence: ConvergenceFx,
};
