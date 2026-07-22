// §8.3 / Q21.5 / Q21.6 定案：GameContext 與 IRandomEvent 型別，及被動機率事件定義。
// SeededRNG 位於同層 events/（定案範例寫 ../math/，此處對齊實際路徑）。

import { SeededRNG } from './SeededRNG';

export interface GameContext {
  currentTick: number;
  rng: SeededRNG;
  currentLevelId: number;
  vehicleSpeedKmh: number;
  isBraking: boolean;
  isHornPressed: boolean;
  pedestrianDistanceMeter: number;
}

export interface IRandomEvent {
  id: string;
  name: string;
  getProbability: (ctx: GameContext) => number; // 每秒觸發機率 p_sec
  canTrigger: (ctx: GameContext) => boolean;
  onTrigger: (ctx: GameContext) => void;
}

// 事件 1：突發貓咪穿越 (§8.3.2)
// 固定 p_sec = 0.02；車速 > 20 km/h（= 5.556 m/s）；「無其它貓咪」由 Manager isAlreadyActive 去重 (Q21.3)
export const STRAY_CAT_CROSSING: IRandomEvent = {
  id: 'STRAY_CAT_CROSSING',
  name: '突發貓咪穿越',
  getProbability: () => 0.02,
  canTrigger: (ctx) => ctx.vehicleSpeedKmh > 20,
  onTrigger: () => {
    // 貓咪實體生成與效果套用由上層 runtime 處理（effect/duration 模型見 §21 Q21.8，尚未定案）
  }
};

// 事件 2：車輛煞車失靈 (§8.3.3)
// 動態 p_sec = 0.01 * (N-1)；關卡 N>=2 且踩煞車時可觸發
export const BRAKE_FAILURE_EVENT: IRandomEvent = {
  id: 'BRAKE_FAILURE_EVENT',
  name: '煞車失靈',
  getProbability: (ctx) => 0.01 * (ctx.currentLevelId - 1),
  canTrigger: (ctx) => ctx.currentLevelId >= 2 && ctx.isBraking,
  onTrigger: () => {
    // 煞車失靈效果套用由上層 runtime 處理（effect/duration 模型見 §21 Q21.8，尚未定案）
  }
};
