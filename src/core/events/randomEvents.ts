// §8.3 / Q21.5 / Q21.6 / Q21.8 定案：GameContext、IRandomEvent、ActiveEventEffect 型別，及被動機率事件定義。
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

// 作用中的持續性事件效果 (§Q21.8)
export interface ActiveEventEffect {
  eventId: string;
  remainingTicks: number;   // 剩餘持續 Tick 數
  brakeMultiplier?: number; // 煞車乘數修飾（0 = 完全煞車失靈）
  speedMultiplier?: number; // 車速乘數修飾
}

export interface IRandomEvent {
  id: string;
  name: string;
  durationTicks?: number; // 效果持續 Tick 數（瞬時事件為 0 或 undefined）
  getProbability: (ctx: GameContext) => number; // 每秒觸發機率 p_sec
  canTrigger: (ctx: GameContext) => boolean;
  onTrigger: (ctx: GameContext) => ActiveEventEffect | void;
}

// 事件 1：突發貓咪穿越 (§8.3.2)，持續 120 Ticks。
// 固定 p_sec = 0.02；車速 > 20 km/h（= 5.556 m/s）；「無其它貓咪」由 Manager isAlreadyActive 去重 (Q21.3)。
// 貓咪不改變車輛物理（不設 brake/speed 乘數），效果僅作為存活期標記；實體生成由上層 runtime 依 triggeredEventIds 處理。
export const STRAY_CAT_CROSSING: IRandomEvent = {
  id: 'STRAY_CAT_CROSSING',
  name: '突發貓咪穿越',
  durationTicks: 120,
  getProbability: () => 0.02,
  canTrigger: (ctx) => ctx.vehicleSpeedKmh > 20,
  onTrigger: () => ({ eventId: 'STRAY_CAT_CROSSING', remainingTicks: 120 })
};

// 事件 2：車輛煞車失靈 (§8.3.3)，持續 90 Ticks。
// 動態 p_sec = 0.01 * (N-1)；關卡 N>=2 且踩煞車時可觸發；期間 brakeMultiplier = 0（煞車無效）。
export const BRAKE_FAILURE_EVENT: IRandomEvent = {
  id: 'BRAKE_FAILURE_EVENT',
  name: '煞車失靈',
  durationTicks: 90,
  getProbability: (ctx) => 0.01 * (ctx.currentLevelId - 1),
  canTrigger: (ctx) => ctx.currentLevelId >= 2 && ctx.isBraking,
  onTrigger: () => ({ eventId: 'BRAKE_FAILURE_EVENT', remainingTicks: 90, brakeMultiplier: 0.0 })
};
