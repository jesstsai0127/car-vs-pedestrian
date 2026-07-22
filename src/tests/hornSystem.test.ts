import { describe, it, expect } from 'vitest';
import { resolveHornStun } from '../core/events/hornSystem';

describe('resolveHornStun: 喇叭主動定身 (§8.3.4, Q21.2)', () => {
  it('按喇叭且路人在 20m 內 -> 100% 觸發定身', () => {
    const r = resolveHornStun({ isHornPressed: true, pedestrianDistanceMeter: 10, hornLevel: 1 });
    expect(r.triggered).toBe(true);
    expect(r.pedestrianFrozen).toBe(true);
  });

  it('未按喇叭 -> 不觸發', () => {
    const r = resolveHornStun({ isHornPressed: false, pedestrianDistanceMeter: 10, hornLevel: 1 });
    expect(r.triggered).toBe(false);
    expect(r.stunTicks).toBe(0);
    expect(r.pedestrianFrozen).toBe(false);
  });

  it('按喇叭但路人在 20m 外 -> 不觸發', () => {
    const r = resolveHornStun({ isHornPressed: true, pedestrianDistanceMeter: 25, hornLevel: 1 });
    expect(r.triggered).toBe(false);
  });

  it('距離剛好等於 20m -> 不觸發（嚴格小於）', () => {
    const r = resolveHornStun({ isHornPressed: true, pedestrianDistanceMeter: 20, hornLevel: 1 });
    expect(r.triggered).toBe(false);
  });

  it('距離 19.99m -> 觸發（邊界內側）', () => {
    const r = resolveHornStun({ isHornPressed: true, pedestrianDistanceMeter: 19.99, hornLevel: 1 });
    expect(r.triggered).toBe(true);
  });

  it('hornLevel=1 -> StunTicks = floor((0.20+0.05)*60) = 15', () => {
    const r = resolveHornStun({ isHornPressed: true, pedestrianDistanceMeter: 5, hornLevel: 1 });
    expect(r.stunTicks).toBe(15);
  });

  it('hornLevel=2 -> StunTicks = floor((0.20+0.10)*60) = 18', () => {
    const r = resolveHornStun({ isHornPressed: true, pedestrianDistanceMeter: 5, hornLevel: 2 });
    expect(r.stunTicks).toBe(18);
  });

  it('hornLevel=5 -> StunTicks = floor((0.20+0.25)*60) = 27', () => {
    const r = resolveHornStun({ isHornPressed: true, pedestrianDistanceMeter: 5, hornLevel: 5 });
    expect(r.stunTicks).toBe(27);
  });
});
