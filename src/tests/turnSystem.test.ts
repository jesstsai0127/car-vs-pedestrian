import { describe, it, expect } from 'vitest';
import { checkTurnSignalCorrectness, processTurnError } from '../core/navigation/turnSystem';

describe('checkTurnSignalCorrectness: 方向燈校驗矩陣 (§10.2.2)', () => {
  it('TURN_LEFT + LEFT = 通過', () => {
    expect(checkTurnSignalCorrectness('TURN_LEFT', 'LEFT').isCorrect).toBe(true);
  });

  it('TURN_LEFT + OFF = 轉錯', () => {
    const r = checkTurnSignalCorrectness('TURN_LEFT', 'OFF');
    expect(r.isCorrect).toBe(false);
    expect(r.failedReason).toBeDefined();
  });

  it('TURN_LEFT + RIGHT = 轉錯', () => {
    expect(checkTurnSignalCorrectness('TURN_LEFT', 'RIGHT').isCorrect).toBe(false);
  });

  it('TURN_RIGHT + RIGHT = 通過', () => {
    expect(checkTurnSignalCorrectness('TURN_RIGHT', 'RIGHT').isCorrect).toBe(true);
  });

  it('TURN_RIGHT + OFF = 轉錯', () => {
    expect(checkTurnSignalCorrectness('TURN_RIGHT', 'OFF').isCorrect).toBe(false);
  });

  it('TURN_RIGHT + LEFT = 轉錯', () => {
    expect(checkTurnSignalCorrectness('TURN_RIGHT', 'LEFT').isCorrect).toBe(false);
  });

  it('STRAIGHT + OFF = 通過', () => {
    expect(checkTurnSignalCorrectness('STRAIGHT', 'OFF').isCorrect).toBe(true);
  });

  it('STRAIGHT + LEFT = 轉錯（直行不該打方向燈）', () => {
    expect(checkTurnSignalCorrectness('STRAIGHT', 'LEFT').isCorrect).toBe(false);
  });

  it('STRAIGHT + RIGHT = 轉錯', () => {
    expect(checkTurnSignalCorrectness('STRAIGHT', 'RIGHT').isCorrect).toBe(false);
  });
});

describe('processTurnError: 轉錯重試與降關 (§10.3, §12.3)', () => {
  it('第 1 次轉錯：retryCount 1，關卡不變，不降關', () => {
    const r = processTurnError(0, 3);
    expect(r.nextRetryCount).toBe(1);
    expect(r.nextLevelId).toBe(3);
    expect(r.isDowngraded).toBe(false);
    expect(r.shouldRestartLevel).toBe(true);
  });

  it('第 2 次轉錯：retryCount 2，關卡不變，不降關', () => {
    const r = processTurnError(1, 3);
    expect(r.nextRetryCount).toBe(2);
    expect(r.nextLevelId).toBe(3);
    expect(r.isDowngraded).toBe(false);
  });

  it('第 3 次轉錯：觸發降關，retryCount 歸零，關卡 -1', () => {
    const r = processTurnError(2, 3);
    expect(r.nextRetryCount).toBe(0);
    expect(r.nextLevelId).toBe(2);
    expect(r.isDowngraded).toBe(true);
    expect(r.shouldRestartLevel).toBe(true);
  });

  it('在第 1 關轉錯 3 次：降關下限保持在 Level 1，不降至 0', () => {
    const r = processTurnError(2, 1);
    expect(r.nextLevelId).toBe(1);
    expect(r.nextRetryCount).toBe(0);
    expect(r.isDowngraded).toBe(true);
  });
});
