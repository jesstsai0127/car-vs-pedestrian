import { describe, it, expect } from 'vitest';
import { GameController } from '../core/engine/GameController';
import { CalculateCollisionInput } from '../core/judgement/collisionEngine';

const repairConfig = { repairCostPerHp: 5 };

const collisionInput: CalculateCollisionInput = {
  impactSpeedMps: 15,
  vehicleWeightClass: 1.0,
  impactZone: 'FRONT',
  timeDiffTicks: 63,
  driverArgLevel: 1,
  pedestrianArgLevel: 1,
  driverBrakeLevel: 1,
  pedestrianDodgeLevel: 1
};

describe('GameController: 初始化與角色 (§Q22.2)', () => {
  it('預設從 BOOTSTRAP 開始，預設角色 DRIVER', () => {
    const gc = new GameController();
    expect(gc.fsm.getCurrentState()).toBe('BOOTSTRAP');
    expect(gc.getActiveRole()).toBe('DRIVER');
  });

  it('setActiveRole 切換角色', () => {
    const gc = new GameController();
    gc.setActiveRole('PEDESTRIAN');
    expect(gc.getActiveRole()).toBe('PEDESTRIAN');
  });
});

describe('GameController: requestStartLevel 戰前檢查驅動 FSM', () => {
  it('通過檢查 -> dispatch START_LEVEL，進入 IN_GAME_RUNNING，回傳 true', () => {
    const gc = new GameController('GARAGE_PREPARATION');
    const ok = gc.requestStartLevel({ role: 'DRIVER', hp: 100, money: 1000, repairConfig });
    expect(ok).toBe(true);
    expect(gc.fsm.getCurrentState()).toBe('IN_GAME_RUNNING');
  });

  it('HP<50 且金錢不足 -> dispatch TRIGGER_BANKRUPT，進入 GAME_OVER_HARD_RESET，回傳 false', () => {
    const gc = new GameController('GARAGE_PREPARATION');
    const ok = gc.requestStartLevel({ role: 'DRIVER', hp: 49, money: 0, repairConfig });
    expect(ok).toBe(false);
    expect(gc.fsm.getCurrentState()).toBe('GAME_OVER_HARD_RESET');
  });

  it('路人資產不足門檻（未破產）-> 不轉移、回傳 false，狀態停在 GARAGE_PREPARATION', () => {
    const gc = new GameController('GARAGE_PREPARATION');
    const ok = gc.requestStartLevel({ role: 'PEDESTRIAN', hp: 100, money: 100, accessMoneyThreshold: 300 });
    expect(ok).toBe(false);
    expect(gc.fsm.getCurrentState()).toBe('GARAGE_PREPARATION');
  });
});

describe('GameController: handleCollision 只觸發凍結、不同步跳判決 (Q22.5)', () => {
  it('dispatch COLLISION_OCCURRED 進入 IN_GAME_PAUSED_ACCIDENT，並回傳判決結果', () => {
    const gc = new GameController('IN_GAME_RUNNING');
    const verdict = gc.handleCollision(collisionInput);
    expect(gc.fsm.getCurrentState()).toBe('IN_GAME_PAUSED_ACCIDENT');
    expect(verdict.finalDriverFaultRatio).toBe(1.0); // ticks=63 -> 駕駛全責
    expect(verdict.payoutAmount).toBeGreaterThan(0);
  });

  it('handleCollision 不會同步跳到 VERDICT_POPUP（須由 TickEngine 凍結後才觸發）', () => {
    const gc = new GameController('IN_GAME_RUNNING');
    gc.handleCollision(collisionInput);
    expect(gc.fsm.getCurrentState()).not.toBe('VERDICT_POPUP');
  });
});

describe('GameController: getCurrentScreen 對應 FSM 狀態與角色', () => {
  it('IN_GAME_RUNNING + DRIVER -> IN_GAME_HUD_DRIVER', () => {
    const gc = new GameController('IN_GAME_RUNNING');
    gc.setActiveRole('DRIVER');
    expect(gc.getCurrentScreen()).toBe('IN_GAME_HUD_DRIVER');
  });

  it('GAME_OVER_HARD_RESET -> BANKRUPT_MODAL', () => {
    const gc = new GameController('GAME_OVER_HARD_RESET');
    expect(gc.getCurrentScreen()).toBe('BANKRUPT_MODAL');
  });
});

describe('GameController: 完整主流程 E2E (§2.4.4 DoD)', () => {
  it('選角 -> 整備 -> 開始關卡 -> 碰撞 -> 凍結，狀態逐步正確', () => {
    const gc = new GameController('ROLE_SELECT');
    gc.setActiveRole('DRIVER');

    // 選角 -> 整備大廳
    gc.fsm.dispatch('SELECT_ROLE');
    expect(gc.getCurrentScreen()).toBe('GARAGE_DRIVER');

    // 戰前檢查通過 -> 進入關卡
    expect(gc.requestStartLevel({ role: 'DRIVER', hp: 100, money: 1000, repairConfig })).toBe(true);
    expect(gc.getCurrentScreen()).toBe('IN_GAME_HUD_DRIVER');

    // 碰撞 -> 凍結
    const verdict = gc.handleCollision(collisionInput);
    expect(gc.fsm.getCurrentState()).toBe('IN_GAME_PAUSED_ACCIDENT');

    // TickEngine 凍結結束後由外層 dispatch SHOW_VERDICT
    gc.fsm.dispatch('SHOW_VERDICT');
    expect(gc.getCurrentScreen()).toBe('VERDICT_MODAL');

    // 簽認判決 -> 返回整備
    gc.fsm.dispatch('CONFIRM_VERDICT');
    expect(gc.getCurrentScreen()).toBe('GARAGE_DRIVER');

    expect(verdict.payoutAmount).toBeGreaterThan(0);
  });
});
