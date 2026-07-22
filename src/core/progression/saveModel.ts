import { GameSaveData, INITIAL_GAME_SAVE } from '../storage/saveSchema';

/**
 * 純函數：計算硬重置後的存檔狀態 (§5.3 Q20.6 定案)
 * 回傳深拷貝，避免呼叫端意外修改到共用的 INITIAL_GAME_SAVE 常數
 */
export function computeHardResetState(): GameSaveData {
  return JSON.parse(JSON.stringify(INITIAL_GAME_SAVE)) as GameSaveData;
}
