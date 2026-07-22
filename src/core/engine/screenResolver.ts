// §16.3 / Q22.3 定案：resolveNextScreen 純函數，以 fsmState 為破產狀態唯一真相來源 (SSOT)。
//
// 目錄決策（Claude 於 2026-07-22 標註待確認）：定案文字建議放 src/ui/screenResolver.ts，
// 但 Q22.2 的 GameController 位於 src/core/engine/ 且會呼叫 resolveNextScreen——若把此檔放 src/ui/，
// 會造成 src/core/ 依賴 src/ui/，違反 §14.2 鐵律 1（core 必須框架/平台無關、不得反向依賴 UI 層）。
// 由於 resolveNextScreen 是零框架依賴的純函數，暫置於 src/core/engine/ 以維持依賴方向正確，
// 並納入 src/core/ 的 100% 覆蓋率要求。詳見 §22 Q22.5，若你堅持放 src/ui/ 請回覆。

import { GameStateType } from './GameFSM';

export type UIScreenType =
  | 'TITLE_SCREEN'
  | 'GARAGE_DRIVER'
  | 'GARAGE_PEDESTRIAN'
  | 'IN_GAME_HUD_DRIVER'
  | 'IN_GAME_HUD_PEDESTRIAN'
  | 'VERDICT_MODAL'
  | 'LEVEL_RESULT_MODAL'
  | 'BANKRUPT_MODAL';

export interface ScreenTransitionRequest {
  currentScreen: UIScreenType;
  fsmState: GameStateType;
  activeRole: 'DRIVER' | 'PEDESTRIAN';
}

/**
 * 純函數：依 FSM 狀態與角色計算應呈現之 UI 畫面 (§16.3, Q22.3)
 */
export function resolveNextScreen(request: ScreenTransitionRequest): UIScreenType {
  // 1. 破產狀態最高優先權（單一真相來源 = fsmState）
  if (request.fsmState === 'GAME_OVER_HARD_RESET') {
    return 'BANKRUPT_MODAL';
  }

  // 2. 依 FSM 狀態分流
  switch (request.fsmState) {
    case 'BOOTSTRAP':
    case 'ROLE_SELECT':
      return 'TITLE_SCREEN';

    case 'GARAGE_PREPARATION':
      return request.activeRole === 'DRIVER' ? 'GARAGE_DRIVER' : 'GARAGE_PEDESTRIAN';

    case 'IN_GAME_RUNNING':
    case 'IN_GAME_PAUSED_ACCIDENT':
      return request.activeRole === 'DRIVER' ? 'IN_GAME_HUD_DRIVER' : 'IN_GAME_HUD_PEDESTRIAN';

    case 'VERDICT_POPUP':
      return 'VERDICT_MODAL';

    case 'LEVEL_RESULT':
      return 'LEVEL_RESULT_MODAL';

    default:
      return 'TITLE_SCREEN';
  }
}
