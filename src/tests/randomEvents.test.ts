import { describe, it, expect } from 'vitest';
import { STRAY_CAT_CROSSING, BRAKE_FAILURE_EVENT, GameContext } from '../core/events/randomEvents';
import { SeededRNG } from '../core/events/SeededRNG';

const ctx = (over: Partial<GameContext>): GameContext => ({
  currentTick: 0,
  rng: new SeededRNG(1),
  currentLevelId: 1,
  vehicleSpeedKmh: 0,
  isBraking: false,
  isHornPressed: false,
  pedestrianDistanceMeter: 100,
  ...over
});

describe('STRAY_CAT_CROSSING 事件定義 (§8.3.2)', () => {
  it('固定機率 p_sec = 0.02', () => {
    expect(STRAY_CAT_CROSSING.getProbability(ctx({}))).toBe(0.02);
  });

  it('車速 > 20 km/h 可觸發', () => {
    expect(STRAY_CAT_CROSSING.canTrigger(ctx({ vehicleSpeedKmh: 21 }))).toBe(true);
  });

  it('車速剛好 20 km/h 不觸發（嚴格大於）', () => {
    expect(STRAY_CAT_CROSSING.canTrigger(ctx({ vehicleSpeedKmh: 20 }))).toBe(false);
  });

  it('車速低於 20 km/h 不觸發', () => {
    expect(STRAY_CAT_CROSSING.canTrigger(ctx({ vehicleSpeedKmh: 10 }))).toBe(false);
  });

  it('onTrigger 可呼叫且不拋錯（effect 模型待 Q21.8）', () => {
    expect(() => STRAY_CAT_CROSSING.onTrigger(ctx({}))).not.toThrow();
  });
});

describe('BRAKE_FAILURE_EVENT 事件定義 (§8.3.3)', () => {
  it('動態機率 p_sec = 0.01 * (N-1)', () => {
    expect(BRAKE_FAILURE_EVENT.getProbability(ctx({ currentLevelId: 1 }))).toBe(0);
    expect(BRAKE_FAILURE_EVENT.getProbability(ctx({ currentLevelId: 2 }))).toBeCloseTo(0.01, 10);
    expect(BRAKE_FAILURE_EVENT.getProbability(ctx({ currentLevelId: 6 }))).toBeCloseTo(0.05, 10);
  });

  it('關卡 N>=2 且踩煞車時可觸發', () => {
    expect(BRAKE_FAILURE_EVENT.canTrigger(ctx({ currentLevelId: 2, isBraking: true }))).toBe(true);
  });

  it('關卡 N=1 時不可觸發（新手保護，機率也為 0）', () => {
    expect(BRAKE_FAILURE_EVENT.canTrigger(ctx({ currentLevelId: 1, isBraking: true }))).toBe(false);
    expect(BRAKE_FAILURE_EVENT.getProbability(ctx({ currentLevelId: 1 }))).toBe(0);
  });

  it('未踩煞車時不可觸發', () => {
    expect(BRAKE_FAILURE_EVENT.canTrigger(ctx({ currentLevelId: 3, isBraking: false }))).toBe(false);
  });

  it('onTrigger 可呼叫且不拋錯（effect 模型待 Q21.8）', () => {
    expect(() => BRAKE_FAILURE_EVENT.onTrigger(ctx({}))).not.toThrow();
  });
});
