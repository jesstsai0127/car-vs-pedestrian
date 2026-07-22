// §8.4 / Q21.8 定案：被動機率隨機事件管理器。
// 每 Tick：評估觸發（canTrigger + rng.nextBool(p/60)、同事件去重）→ 計算當前合併效果 → 遞減 remainingTicks、到期自動清除。
// 主動事件（喇叭定身）不走此處，見 hornSystem.ts。

import { GameContext, IRandomEvent, ActiveEventEffect } from './randomEvents';

export interface RandomEventStepResult {
  triggeredEventIds: string[];      // 本 Tick 新觸發的事件 id
  activeEffects: ActiveEventEffect[]; // 遞減後仍作用中的效果快照
  brakeMultiplier: number;          // 所有作用中效果的煞車乘數乘積（預設 1.0）
  speedMultiplier: number;          // 車速乘數乘積（預設 1.0）
}

export class RandomEventManager {
  private activeEffects: ActiveEventEffect[] = [];

  constructor(private readonly events: IRandomEvent[]) {}

  isAlreadyActive(eventId: string): boolean {
    return this.activeEffects.some((e) => e.eventId === eventId);
  }

  getActiveEffects(): ActiveEventEffect[] {
    return this.activeEffects.map((e) => ({ ...e }));
  }

  reset(): void {
    this.activeEffects = [];
  }

  /**
   * 推進一 Tick。回傳本 Tick 的觸發結果與當前合併效果。
   */
  step(ctx: GameContext): RandomEventStepResult {
    const triggeredEventIds: string[] = [];

    // 1. 評估新觸發（同事件執行中則跳過 → 去重，Q21.3）
    for (const event of this.events) {
      if (this.isAlreadyActive(event.id)) continue;
      if (!event.canTrigger(ctx)) continue;
      const pTick = event.getProbability(ctx) / 60;
      if (ctx.rng.nextBool(pTick)) {
        const effect = event.onTrigger(ctx);
        if (effect) {
          this.activeEffects.push({ ...effect });
        }
        triggeredEventIds.push(event.id);
      }
    }

    // 2. 計算當前（含本 Tick 新觸發）的合併效果
    let brakeMultiplier = 1.0;
    let speedMultiplier = 1.0;
    for (const e of this.activeEffects) {
      if (e.brakeMultiplier !== undefined) brakeMultiplier *= e.brakeMultiplier;
      if (e.speedMultiplier !== undefined) speedMultiplier *= e.speedMultiplier;
    }

    // 3. 遞減並清除到期效果（本 Tick 剛觸發者於下一 Tick 起才被遞減）
    this.activeEffects = this.activeEffects
      .map((e) => ({ ...e, remainingTicks: e.remainingTicks - 1 }))
      .filter((e) => e.remainingTicks > 0);

    return {
      triggeredEventIds,
      activeEffects: this.getActiveEffects(),
      brakeMultiplier,
      speedMultiplier
    };
  }
}
