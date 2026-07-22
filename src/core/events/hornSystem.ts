// §8.3.4 / Q21.2 定案：喇叭定身為「主動機制」，不走 processRandomEvents 機率迴圈。
// isHornPressed === true 且 pedestrianDistanceMeter < 20 時 100% 確定性觸發。

export interface HornStunInput {
  isHornPressed: boolean;
  pedestrianDistanceMeter: number;
  hornLevel: number;
}

export interface HornStunResult {
  triggered: boolean;
  stunTicks: number;         // 觸發時的定身持續 Tick 數，未觸發為 0
  pedestrianFrozen: boolean; // 觸發時為 true
}

const HORN_RANGE_METER = 20;

/**
 * 純函數：判定喇叭定身是否觸發並計算定身時長 (§8.3.4)
 * StunTicks = floor((0.20 + hornLevel * 0.05) * 60)
 */
export function resolveHornStun(input: HornStunInput): HornStunResult {
  const inRange = input.pedestrianDistanceMeter < HORN_RANGE_METER;

  if (!input.isHornPressed || !inRange) {
    return { triggered: false, stunTicks: 0, pedestrianFrozen: false };
  }

  const stunTicks = Math.floor((0.2 + input.hornLevel * 0.05) * 60);
  return { triggered: true, stunTicks, pedestrianFrozen: true };
}
