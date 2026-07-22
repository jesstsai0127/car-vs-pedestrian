import { describe, it, expect } from 'vitest';
import { TickEngine } from '../core/engine/TickEngine';

describe('TickEngine: 固定時間步長計數器 (§9.1, Q21.4)', () => {
  it('初始 tick 為 0', () => {
    const engine = new TickEngine();
    expect(engine.getCurrentTick()).toBe(0);
  });

  it('step() 推進一格並回傳最新 tick 數', () => {
    const engine = new TickEngine();
    expect(engine.step()).toBe(1);
    expect(engine.step()).toBe(2);
    expect(engine.getCurrentTick()).toBe(2);
  });

  it('onTick 回調在每次 step 收到 (currentTick, deltaSec)', () => {
    const engine = new TickEngine();
    const received: Array<[number, number]> = [];
    engine.onTick((tick, delta) => received.push([tick, delta]));

    engine.step();
    engine.step();

    expect(received).toEqual([
      [1, 1 / 60],
      [2, 1 / 60]
    ]);
  });

  it('deltaSec 恆為 1/60（固定步長，不受呼叫頻率影響）', () => {
    const engine = new TickEngine();
    let captured = 0;
    engine.onTick((_tick, delta) => { captured = delta; });
    engine.step();
    expect(captured).toBeCloseTo(0.0166667, 6);
  });

  it('多個 onTick 訂閱者都會被呼叫', () => {
    const engine = new TickEngine();
    let a = 0;
    let b = 0;
    engine.onTick(() => { a += 1; });
    engine.onTick(() => { b += 1; });
    engine.step();
    expect(a).toBe(1);
    expect(b).toBe(1);
  });

  it('reset() 將 tick 歸零（不清除訂閱者）', () => {
    const engine = new TickEngine();
    let calls = 0;
    engine.onTick(() => { calls += 1; });
    engine.step();
    engine.step();
    engine.reset();
    expect(engine.getCurrentTick()).toBe(0);

    engine.step();
    expect(engine.getCurrentTick()).toBe(1);
    expect(calls).toBe(3); // 訂閱者在 reset 後仍有效
  });

  it('無訂閱者時 step 仍正常推進', () => {
    const engine = new TickEngine();
    expect(engine.step()).toBe(1);
  });
});
