import { describe, it, expect } from 'vitest';
import { GameFSM, InvalidStateTransitionError } from '../core/engine/GameFSM';

describe('GameFSM: §4.3.2 合法轉移矩陣 (12 條)', () => {
  it('BOOTSTRAP + INIT_COMPLETE -> ROLE_SELECT', () => {
    const fsm = new GameFSM('BOOTSTRAP');
    expect(fsm.dispatch('INIT_COMPLETE')).toBe('ROLE_SELECT');
  });

  it('ROLE_SELECT + SELECT_ROLE -> GARAGE_PREPARATION', () => {
    const fsm = new GameFSM('ROLE_SELECT');
    expect(fsm.dispatch('SELECT_ROLE')).toBe('GARAGE_PREPARATION');
  });

  it('GARAGE_PREPARATION + START_LEVEL -> IN_GAME_RUNNING', () => {
    const fsm = new GameFSM('GARAGE_PREPARATION');
    expect(fsm.dispatch('START_LEVEL')).toBe('IN_GAME_RUNNING');
  });

  it('GARAGE_PREPARATION + SWITCH_ROLE -> ROLE_SELECT', () => {
    const fsm = new GameFSM('GARAGE_PREPARATION');
    expect(fsm.dispatch('SWITCH_ROLE')).toBe('ROLE_SELECT');
  });

  it('GARAGE_PREPARATION + TRIGGER_BANKRUPT -> GAME_OVER_HARD_RESET', () => {
    const fsm = new GameFSM('GARAGE_PREPARATION');
    expect(fsm.dispatch('TRIGGER_BANKRUPT')).toBe('GAME_OVER_HARD_RESET');
  });

  it('IN_GAME_RUNNING + COLLISION_OCCURRED -> IN_GAME_PAUSED_ACCIDENT', () => {
    const fsm = new GameFSM('IN_GAME_RUNNING');
    expect(fsm.dispatch('COLLISION_OCCURRED')).toBe('IN_GAME_PAUSED_ACCIDENT');
  });

  it('IN_GAME_RUNNING + LEVEL_CLEAR -> LEVEL_RESULT', () => {
    const fsm = new GameFSM('IN_GAME_RUNNING');
    expect(fsm.dispatch('LEVEL_CLEAR')).toBe('LEVEL_RESULT');
  });

  it('IN_GAME_PAUSED_ACCIDENT + SHOW_VERDICT -> VERDICT_POPUP', () => {
    const fsm = new GameFSM('IN_GAME_PAUSED_ACCIDENT');
    expect(fsm.dispatch('SHOW_VERDICT')).toBe('VERDICT_POPUP');
  });

  it('VERDICT_POPUP + CONFIRM_VERDICT -> GARAGE_PREPARATION', () => {
    const fsm = new GameFSM('VERDICT_POPUP');
    expect(fsm.dispatch('CONFIRM_VERDICT')).toBe('GARAGE_PREPARATION');
  });

  it('VERDICT_POPUP + TRIGGER_BANKRUPT -> GAME_OVER_HARD_RESET', () => {
    const fsm = new GameFSM('VERDICT_POPUP');
    expect(fsm.dispatch('TRIGGER_BANKRUPT')).toBe('GAME_OVER_HARD_RESET');
  });

  it('LEVEL_RESULT + RETURN_TO_GARAGE -> GARAGE_PREPARATION', () => {
    const fsm = new GameFSM('LEVEL_RESULT');
    expect(fsm.dispatch('RETURN_TO_GARAGE')).toBe('GARAGE_PREPARATION');
  });

  it('GAME_OVER_HARD_RESET + EXECUTE_HARD_RESET -> ROLE_SELECT', () => {
    const fsm = new GameFSM('GAME_OVER_HARD_RESET');
    expect(fsm.dispatch('EXECUTE_HARD_RESET')).toBe('ROLE_SELECT');
  });
});

describe('GameFSM: 非法轉移必須拋出 InvalidStateTransitionError (§2.4.2 DoD)', () => {
  it('在 VERDICT_POPUP 發送 ACCELERATE 這類未定義動作應拋出例外', () => {
    const fsm = new GameFSM('VERDICT_POPUP');
    expect(() => fsm.dispatch('ACCELERATE' as any)).toThrow(InvalidStateTransitionError);
  });

  it('在 IN_GAME_RUNNING 發送 CONFIRM_VERDICT（屬於別的狀態的合法動作）應拋出例外', () => {
    const fsm = new GameFSM('IN_GAME_RUNNING');
    expect(() => fsm.dispatch('CONFIRM_VERDICT')).toThrow(InvalidStateTransitionError);
  });

  it('例外物件帶有正確的 fromState 與 action，方便除錯與斷言', () => {
    const fsm = new GameFSM('BOOTSTRAP');
    try {
      fsm.dispatch('LEVEL_CLEAR');
      expect.unreachable('應該要拋出例外');
    } catch (err) {
      expect(err).toBeInstanceOf(InvalidStateTransitionError);
      const typedErr = err as InvalidStateTransitionError;
      expect(typedErr.fromState).toBe('BOOTSTRAP');
      expect(typedErr.action).toBe('LEVEL_CLEAR');
    }
  });

  it('非法轉移不得變更當前狀態', () => {
    const fsm = new GameFSM('GARAGE_PREPARATION');
    expect(() => fsm.dispatch('SHOW_VERDICT')).toThrow(InvalidStateTransitionError);
    expect(fsm.getCurrentState()).toBe('GARAGE_PREPARATION');
  });
});

describe('GameFSM: onStateChange 觀察者介面 (§4.3.4 Q20.5)', () => {
  it('狀態轉移時廣播 (from, to) 給所有訂閱者', () => {
    const fsm = new GameFSM('BOOTSTRAP');
    const received: Array<[string, string]> = [];
    fsm.onStateChange((from, to) => received.push([from, to]));

    fsm.dispatch('INIT_COMPLETE');

    expect(received).toEqual([['BOOTSTRAP', 'ROLE_SELECT']]);
  });

  it('取消訂閱後不再收到通知', () => {
    const fsm = new GameFSM('BOOTSTRAP');
    const received: Array<[string, string]> = [];
    const unsubscribe = fsm.onStateChange((from, to) => received.push([from, to]));

    unsubscribe();
    fsm.dispatch('INIT_COMPLETE');

    expect(received).toEqual([]);
  });

  it('多個訂閱者都會收到通知', () => {
    const fsm = new GameFSM('ROLE_SELECT');
    let countA = 0;
    let countB = 0;
    fsm.onStateChange(() => { countA += 1; });
    fsm.onStateChange(() => { countB += 1; });

    fsm.dispatch('SELECT_ROLE');

    expect(countA).toBe(1);
    expect(countB).toBe(1);
  });

  it('非法轉移拋出例外時不應觸發訂閱者回呼', () => {
    const fsm = new GameFSM('VERDICT_POPUP');
    let called = false;
    fsm.onStateChange(() => { called = true; });

    expect(() => fsm.dispatch('ACCELERATE' as any)).toThrow(InvalidStateTransitionError);
    expect(called).toBe(false);
  });
});

describe('GameFSM: getCurrentState 初始狀態', () => {
  it('預設從 BOOTSTRAP 開始', () => {
    const fsm = new GameFSM();
    expect(fsm.getCurrentState()).toBe('BOOTSTRAP');
  });

  it('可指定任意合法初始狀態（例如測試中直接從某狀態開始）', () => {
    const fsm = new GameFSM('IN_GAME_RUNNING');
    expect(fsm.getCurrentState()).toBe('IN_GAME_RUNNING');
  });
});
