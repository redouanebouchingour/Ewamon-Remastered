/**
 * Claim a Dex completion reward (`POST /dex/rewards/:rewardId/claim`): money and items through the inventory writer,
 * the claimed list through the progression writer (deviation D4: REST dex extras ride a `progressionDelta` literal).
 */
import { dexRewardById } from '@ewa/content';
import { apiFetch } from '../../net/api';
import { toast } from '../../state/notifications';
import { toInventoryDelta, toProgressionDelta, useSessionStore } from '../../state/session';

export async function claimDexReward(rewardId: string): Promise<void> {
  const res = await apiFetch('dexRewardClaim', { params: { rewardId } });
  const st = useSessionStore.getState();
  st.applyInventoryDelta(toInventoryDelta({ inventory: res.inventory, money: res.money }));
  st.applyProgressionDelta(toProgressionDelta({ dexRewards: res.rewards }));
  const def = dexRewardById(rewardId);
  toast('success', `${def?.title ?? 'Reward'} claimed.${def?.trainerTitle !== undefined ? ` New title: ${def.trainerTitle}.` : ''}`);
}
