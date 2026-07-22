import { GameSaveData, INITIAL_GAME_SAVE } from '../storage/saveSchema';

/**
 * 純函數：計算硬重置後的存檔狀態 (§5.3 Q20.6 定案)
 * 回傳深拷貝，避免呼叫端意外修改到共用的 INITIAL_GAME_SAVE 常數
 */
export function computeHardResetState(): GameSaveData {
  return JSON.parse(JSON.stringify(INITIAL_GAME_SAVE)) as GameSaveData;
}

/**
 * 純函數：修復與遷移不完整的原始存檔物件 (§13.4 / Q23.1 定案)
 * 時間戳由呼叫端注入（currentTimestamp），core 內不呼叫 Date.now()（§14.2 鐵律 1）。
 * @param rawData 讀取到的未知資料（可能舊版、缺欄位或非法）
 * @param currentTimestamp 由外層注入的當前時間戳（ms）
 */
export function validateAndMigrateSaveData(rawData: unknown, currentTimestamp: number): GameSaveData {
  if (typeof rawData !== 'object' || rawData === null) {
    return { ...computeHardResetState(), lastSavedTimestamp: currentTimestamp };
  }

  const data = rawData as Partial<GameSaveData>;
  const init = INITIAL_GAME_SAVE;

  return {
    version: '1.0.0',
    lastSavedTimestamp:
      typeof data.lastSavedTimestamp === 'number' ? data.lastSavedTimestamp : currentTimestamp,
    activeRole: data.activeRole === 'PEDESTRIAN' ? 'PEDESTRIAN' : 'DRIVER',

    driver: {
      currentLevel: Math.max(1, data.driver?.currentLevel ?? init.driver.currentLevel),
      money: typeof data.driver?.money === 'number' ? data.driver.money : init.driver.money,
      vehicleHp: Math.max(0, Math.min(100, data.driver?.vehicleHp ?? init.driver.vehicleHp)),
      selectedVehicleId: data.driver?.selectedVehicleId ?? init.driver.selectedVehicleId,
      unlockedVehicleIds: Array.isArray(data.driver?.unlockedVehicleIds)
        ? data.driver.unlockedVehicleIds
        : [...init.driver.unlockedVehicleIds],
      stats: {
        brakeLevel: Math.max(1, data.driver?.stats?.brakeLevel ?? 1),
        hornLevel: Math.max(1, data.driver?.stats?.hornLevel ?? 1),
        defenseArgLevel: Math.max(1, data.driver?.stats?.defenseArgLevel ?? 1)
      },
      levelRecords: data.driver?.levelRecords ?? JSON.parse(JSON.stringify(init.driver.levelRecords))
    },

    pedestrian: {
      currentLevel: Math.max(1, data.pedestrian?.currentLevel ?? init.pedestrian.currentLevel),
      money: typeof data.pedestrian?.money === 'number' ? data.pedestrian.money : init.pedestrian.money,
      hp: Math.max(0, Math.min(100, data.pedestrian?.hp ?? init.pedestrian.hp)),
      stats: {
        speedLevel: Math.max(1, data.pedestrian?.stats?.speedLevel ?? 1),
        dodgeLevel: Math.max(1, data.pedestrian?.stats?.dodgeLevel ?? 1),
        defenseArgLevel: Math.max(1, data.pedestrian?.stats?.defenseArgLevel ?? 1)
      },
      levelRecords:
        data.pedestrian?.levelRecords ?? JSON.parse(JSON.stringify(init.pedestrian.levelRecords))
    }
  };
}
