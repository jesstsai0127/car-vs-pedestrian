// §Q22.2 / Q22.5 定案：Headless Orchestrator，串接 FSM / TickEngine / PreGameCheck / CollisionEngine / screenResolver。
// 位於 src/core/，僅依賴同層純邏輯模組，不反向依賴 src/ui/（§14.2 鐵律 1）。

import { GameFSM, GameStateType } from './GameFSM';
import { TickEngine } from './TickEngine';
import { validatePreGameAccess, PreGameAccessInput } from '../progression/preGameCheck';
import {
  calculateCollision,
  CalculateCollisionInput,
  CalculateCollisionOutput
} from '../judgement/collisionEngine';
import { UIScreenType, resolveNextScreen } from './screenResolver';

export class GameController {
  public readonly fsm: GameFSM;
  public readonly tickEngine: TickEngine;
  private activeRole: 'DRIVER' | 'PEDESTRIAN' = 'DRIVER';

  constructor(initialState: GameStateType = 'BOOTSTRAP') {
    this.fsm = new GameFSM(initialState);
    this.tickEngine = new TickEngine();
  }

  setActiveRole(role: 'DRIVER' | 'PEDESTRIAN'): void {
    this.activeRole = role;
  }

  getActiveRole(): 'DRIVER' | 'PEDESTRIAN' {
    return this.activeRole;
  }

  /**
   * 發起戰前檢查並自動驅動 FSM 轉移。
   * 通過 -> dispatch START_LEVEL 回傳 true；破產 -> dispatch TRIGGER_BANKRUPT 回傳 false；
   * 其餘（資產不足但未破產）-> 不轉移、回傳 false。
   */
  requestStartLevel(input: PreGameAccessInput): boolean {
    const accessResult = validatePreGameAccess(input);
    if (accessResult.canPass) {
      this.fsm.dispatch('START_LEVEL');
      return true;
    }
    if (accessResult.triggerBankrupt) {
      this.fsm.dispatch('TRIGGER_BANKRUPT');
      return false;
    }
    return false;
  }

  /**
   * 處理碰撞：僅觸發凍結狀態並回傳判決結果。
   * SHOW_VERDICT 不在此同步觸發，須由 TickEngine 於物理凍結（50ms / 3 Ticks）結束後非同步 dispatch。
   */
  handleCollision(input: CalculateCollisionInput): CalculateCollisionOutput {
    this.fsm.dispatch('COLLISION_OCCURRED');
    return calculateCollision(input);
  }

  getCurrentScreen(): UIScreenType {
    return resolveNextScreen({
      currentScreen: 'TITLE_SCREEN',
      fsmState: this.fsm.getCurrentState(),
      activeRole: this.activeRole
    });
  }
}
