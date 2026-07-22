import { IStorageAdapter } from '../core/storage/StorageAdapter';
import { GameSaveData } from '../core/storage/saveSchema';
import { computeHardResetState } from '../core/progression/saveModel';

/**
 * 協調函數：實際執行破產/主動重置的 I/O 動作 (§5.3 Q20.6)
 * 不屬於 src/core/，允許呼叫 adapter 的 I/O 方法
 */
export function executeHardReset(adapter: IStorageAdapter, storageKey: string): GameSaveData {
  adapter.clear();
  const resetState = computeHardResetState();
  adapter.setItem(storageKey, JSON.stringify(resetState));
  return resetState;
}
