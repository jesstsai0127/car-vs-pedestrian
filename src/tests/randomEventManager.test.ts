import { describe, it, expect } from 'vitest';
import { RandomEventManager } from '../core/events/RandomEventManager';
import {
  STRAY_CAT_CROSSING,
  BRAKE_FAILURE_EVENT,
  GameContext,
  IRandomEvent,
  ActiveEventEffect
} from '../core/events/randomEvents';
import { SeededRNG } from '../core/events/SeededRNG';

const ctx = (over: Partial<GameContext> = {}): GameContext => ({
  currentTick: 0,
  rng: new SeededRNG(1),
  currentLevelId: 1,
  vehicleSpeedKmh: 0,
  isBraking: false,
  isHornPressed: false,
  pedestrianDistanceMeter: 100,
  ...over
});

// p_sec = 60 -> pTick = 1.0 -> nextBool 必為 true，觸發與 seed 無關（供確定性機制測試）
const alwaysEvent = (
  id: string,
  durationTicks: number,
  effect?: Partial<ActiveEventEffect>
): IRandomEvent => ({
  id,
  name: id,
  durationTicks,
  getProbability: () => 60,
  canTrigger: () => true,
  onTrigger: () => ({ eventId: id, remainingTicks: durationTicks, ...effect })
});

describe('RandomEventManager: 觸發與去重 (§8.4, Q21.3)', () => {
  it('canTrigger + 機率通過時觸發，回傳 triggeredEventIds', () => {
    const mgr = new RandomEventManager([alwaysEvent('E1', 5)]);
    const r = mgr.step(ctx());
    expect(r.triggeredEventIds).toContain('E1');
    expect(mgr.isAlreadyActive('E1')).toBe(true);
  });

  it('同一事件執行中不重複觸發（去重）', () => {
    const mgr = new RandomEventManager([alwaysEvent('E1', 5)]);
    mgr.step(ctx()); // 觸發
    const r2 = mgr.step(ctx()); // 仍在執行中
    expect(r2.triggeredEventIds).not.toContain('E1');
  });

  it('getProbability=0 的事件永不觸發', () => {
    const zero: IRandomEvent = {
      id: 'ZERO', name: 'ZERO', durationTicks: 5,
      getProbability: () => 0, canTrigger: () => true,
      onTrigger: () => ({ eventId: 'ZERO', remainingTicks: 5 })
    };
    const mgr = new RandomEventManager([zero]);
    for (let i = 0; i < 100; i++) {
      expect(mgr.step(ctx()).triggeredEventIds).toHaveLength(0);
    }
  });

  it('onTrigger 回傳 void 時仍記為觸發，但不加入 activeEffects', () => {
    const voidEvent: IRandomEvent = {
      id: 'V', name: 'V', durationTicks: 0,
      getProbability: () => 60, canTrigger: () => true,
      onTrigger: () => {}
    };
    const mgr = new RandomEventManager([voidEvent]);
    const r = mgr.step(ctx());
    expect(r.triggeredEventIds).toContain('V');
    expect(r.activeEffects).toHaveLength(0);
  });
});

describe('RandomEventManager: 持續時間與到期清除 (§Q21.8)', () => {
  it('brakeMultiplier=0 的效果恰好持續 durationTicks 個 Tick 後失效', () => {
    // 一次性 stub：只在第一次觸發，之後 canTrigger=false，才能觀察到期後的空窗
    let armed = true;
    const oneShot: IRandomEvent = {
      id: 'BRAKE', name: 'BRAKE', durationTicks: 3,
      getProbability: () => 60,
      canTrigger: () => armed,
      onTrigger: () => { armed = false; return { eventId: 'BRAKE', remainingTicks: 3, brakeMultiplier: 0 }; }
    };
    const mgr = new RandomEventManager([oneShot]);

    const s1 = mgr.step(ctx());
    const s2 = mgr.step(ctx());
    const s3 = mgr.step(ctx());
    const s4 = mgr.step(ctx());

    expect(s1.brakeMultiplier).toBe(0); // 觸發當 Tick 即生效
    expect(s2.brakeMultiplier).toBe(0);
    expect(s3.brakeMultiplier).toBe(0); // 第 3 個 Tick 仍有效
    expect(s4.brakeMultiplier).toBe(1.0); // 第 4 個 Tick 已失效，回復預設
    expect(mgr.isAlreadyActive('BRAKE')).toBe(false);
  });

  it('未觸發任何效果時，brakeMultiplier / speedMultiplier 預設為 1.0', () => {
    const mgr = new RandomEventManager([]);
    const r = mgr.step(ctx());
    expect(r.brakeMultiplier).toBe(1.0);
    expect(r.speedMultiplier).toBe(1.0);
  });

  it('多個作用中效果的乘數相乘疊加', () => {
    const mgr = new RandomEventManager([
      alwaysEvent('A', 10, { speedMultiplier: 0.5 }),
      alwaysEvent('B', 10, { speedMultiplier: 0.5 })
    ]);
    const r = mgr.step(ctx());
    expect(r.speedMultiplier).toBe(0.25); // 0.5 * 0.5
  });

  it('reset 清空所有作用中效果', () => {
    const mgr = new RandomEventManager([alwaysEvent('E1', 100)]);
    mgr.step(ctx());
    expect(mgr.isAlreadyActive('E1')).toBe(true);
    mgr.reset();
    expect(mgr.isAlreadyActive('E1')).toBe(false);
    expect(mgr.getActiveEffects()).toHaveLength(0);
  });
});

describe('RandomEventManager: 真實事件整合與可重現性', () => {
  it('BRAKE_FAILURE 在 Level 1 永不觸發（canTrigger 閘門 + 機率 0）', () => {
    const mgr = new RandomEventManager([BRAKE_FAILURE_EVENT]);
    for (let i = 0; i < 600; i++) {
      expect(mgr.step(ctx({ currentLevelId: 1, isBraking: true })).triggeredEventIds).toHaveLength(0);
    }
  });

  it('STRAY_CAT 車速 <=20 時永不觸發', () => {
    const mgr = new RandomEventManager([STRAY_CAT_CROSSING]);
    for (let i = 0; i < 600; i++) {
      expect(mgr.step(ctx({ vehicleSpeedKmh: 20 })).triggeredEventIds).toHaveLength(0);
    }
  });

  it('相同 seed 的 rng 驅動觸發序列 100% 可重現（決定性，且非空）', () => {
    // pTick = 30/60 = 0.5，由 rng 決定每 tick 是否觸發；dur=1 使其可連續評估
    const halfProb = (): IRandomEvent => ({
      id: 'HALF', name: 'HALF', durationTicks: 1,
      getProbability: () => 30, canTrigger: () => true,
      onTrigger: () => ({ eventId: 'HALF', remainingTicks: 1 })
    });
    const run = () => {
      const rng = new SeededRNG(12345);
      const mgr = new RandomEventManager([halfProb()]);
      const fired: number[] = [];
      for (let tick = 0; tick < 200; tick++) {
        if (mgr.step({ ...ctx(), rng, currentTick: tick }).triggeredEventIds.includes('HALF')) fired.push(tick);
      }
      return fired;
    };
    const a = run();
    const b = run();
    expect(a).toEqual(b);           // 同 seed → 完全相同序列
    expect(a.length).toBeGreaterThan(0); // pTick=0.5，200 tick 幾乎必有觸發（由 seed 決定，非機率賭注）
  });

  it('事件到期後才可再觸發，連續觸發間隔恰等於 durationTicks（去重 + 到期）', () => {
    // 必觸發（pTick=1）、dur=3 的 stub：觸發後鎖 3 tick，第 4 tick 到期才再觸發
    const mgr = new RandomEventManager([alwaysEvent('LOOP', 3)]);
    const fired: number[] = [];
    for (let tick = 0; tick < 12; tick++) {
      if (mgr.step({ ...ctx(), currentTick: tick }).triggeredEventIds.includes('LOOP')) fired.push(tick);
    }
    expect(fired).toEqual([0, 3, 6, 9]); // 每 3 tick 一次，證明去重期 = durationTicks
  });
});
