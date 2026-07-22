import { describe, it, expect } from 'vitest';
import { SeededRNG } from '../core/events/SeededRNG';

describe('SeededRNG: Mulberry32 可重現性 (§8.1, §14.2 鐵律 3)', () => {
  it('相同 seed 產生完全相同的序列（決定性）', () => {
    const a = new SeededRNG(12345);
    const b = new SeededRNG(12345);
    for (let i = 0; i < 20; i++) {
      expect(a.nextFloat()).toBe(b.nextFloat());
    }
  });

  it('不同 seed 產生不同序列', () => {
    const a = new SeededRNG(12345);
    const b = new SeededRNG(54321);
    expect(a.nextFloat()).not.toBe(b.nextFloat());
  });

  it('seed=12345 前三個 nextFloat golden values（鎖定 Mulberry32 輸出）', () => {
    const r = new SeededRNG(12345);
    expect(r.nextFloat()).toBeCloseTo(0.979728267760947, 12);
    expect(r.nextFloat()).toBeCloseTo(0.306752264499664, 12);
    expect(r.nextFloat()).toBeCloseTo(0.484205421525985, 12);
  });

  it('nextFloat 輸出恆落在 [0.0, 1.0) 區間', () => {
    const r = new SeededRNG(777);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextFloat();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
});

describe('SeededRNG: nextInt 閉區間整數', () => {
  it('nextInt(min,max) 恆落在 [min, max] 閉區間', () => {
    const r = new SeededRNG(2024);
    for (let i = 0; i < 1000; i++) {
      const v = r.nextInt(3, 8);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(8);
      expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('nextInt(n,n) 恆回傳 n', () => {
    const r = new SeededRNG(1);
    expect(r.nextInt(5, 5)).toBe(5);
  });

  it('相同 seed 的 nextInt 序列可重現', () => {
    const a = new SeededRNG(42);
    const b = new SeededRNG(42);
    for (let i = 0; i < 10; i++) {
      expect(a.nextInt(0, 100)).toBe(b.nextInt(0, 100));
    }
  });
});

describe('SeededRNG: nextBool 機率', () => {
  it('probability=0 恆回傳 false（nextFloat < 0 永不成立）', () => {
    const r = new SeededRNG(99);
    for (let i = 0; i < 100; i++) {
      expect(r.nextBool(0)).toBe(false);
    }
  });

  it('probability=1 恆回傳 true（nextFloat < 1 恆成立）', () => {
    const r = new SeededRNG(99);
    for (let i = 0; i < 100; i++) {
      expect(r.nextBool(1)).toBe(true);
    }
  });

  it('相同 seed 的 nextBool 序列可重現', () => {
    const a = new SeededRNG(555);
    const b = new SeededRNG(555);
    for (let i = 0; i < 10; i++) {
      expect(a.nextBool(0.5)).toBe(b.nextBool(0.5));
    }
  });
});

describe('SeededRNG: getState 狀態快照', () => {
  it('getState 回傳內部狀態，且會隨每次 nextFloat 前進', () => {
    const r = new SeededRNG(100);
    const s0 = r.getState();
    r.nextFloat();
    const s1 = r.getState();
    expect(s1).not.toBe(s0);
  });

  it('建構時 seed 立即經 >>> 0 正規化為無符號 32 位元', () => {
    const r = new SeededRNG(-1); // -1 >>> 0 = 4294967295
    expect(r.getState()).toBe(4294967295);
  });
});
