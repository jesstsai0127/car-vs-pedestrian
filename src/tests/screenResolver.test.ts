import { describe, it, expect } from 'vitest';
import { resolveNextScreen } from '../core/engine/screenResolver';

const req = (fsmState: any, activeRole: 'DRIVER' | 'PEDESTRIAN' = 'DRIVER') => ({
  currentScreen: 'TITLE_SCREEN' as const,
  fsmState,
  activeRole
});

describe('resolveNextScreen: FSM 狀態 -> UI 畫面 (§16.3, Q22.3 SSOT)', () => {
  it('GAME_OVER_HARD_RESET -> BANKRUPT_MODAL（破產最高優先，唯一真相來源）', () => {
    expect(resolveNextScreen(req('GAME_OVER_HARD_RESET'))).toBe('BANKRUPT_MODAL');
  });

  it('BOOTSTRAP / ROLE_SELECT -> TITLE_SCREEN', () => {
    expect(resolveNextScreen(req('BOOTSTRAP'))).toBe('TITLE_SCREEN');
    expect(resolveNextScreen(req('ROLE_SELECT'))).toBe('TITLE_SCREEN');
  });

  it('GARAGE_PREPARATION 依角色分流 DRIVER/PEDESTRIAN', () => {
    expect(resolveNextScreen(req('GARAGE_PREPARATION', 'DRIVER'))).toBe('GARAGE_DRIVER');
    expect(resolveNextScreen(req('GARAGE_PREPARATION', 'PEDESTRIAN'))).toBe('GARAGE_PEDESTRIAN');
  });

  it('IN_GAME_RUNNING / IN_GAME_PAUSED_ACCIDENT 依角色分流 HUD', () => {
    expect(resolveNextScreen(req('IN_GAME_RUNNING', 'DRIVER'))).toBe('IN_GAME_HUD_DRIVER');
    expect(resolveNextScreen(req('IN_GAME_PAUSED_ACCIDENT', 'PEDESTRIAN'))).toBe('IN_GAME_HUD_PEDESTRIAN');
  });

  it('VERDICT_POPUP -> VERDICT_MODAL', () => {
    expect(resolveNextScreen(req('VERDICT_POPUP'))).toBe('VERDICT_MODAL');
  });

  it('LEVEL_RESULT -> LEVEL_RESULT_MODAL', () => {
    expect(resolveNextScreen(req('LEVEL_RESULT'))).toBe('LEVEL_RESULT_MODAL');
  });

  it('未知/非法狀態走 default 保底回 TITLE_SCREEN（防禦性分支）', () => {
    expect(resolveNextScreen(req('UNKNOWN_STATE' as any))).toBe('TITLE_SCREEN');
  });

  it('8 個 GameStateType 全部有對應畫面（無漏接）', () => {
    const states = [
      'BOOTSTRAP', 'ROLE_SELECT', 'GARAGE_PREPARATION', 'IN_GAME_RUNNING',
      'IN_GAME_PAUSED_ACCIDENT', 'VERDICT_POPUP', 'LEVEL_RESULT', 'GAME_OVER_HARD_RESET'
    ];
    for (const s of states) {
      expect(resolveNextScreen(req(s))).toBeDefined();
    }
  });
});
