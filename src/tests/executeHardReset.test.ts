import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../core/storage/StorageAdapter';
import { INITIAL_GAME_SAVE } from '../core/storage/saveSchema';
import { executeHardReset } from '../adapters/executeHardReset';

const STORAGE_KEY = 'CAR_VS_PEDESTRIAN_SAVE_v1';

describe('executeHardReset: 存儲測試 (§2.4.2 DoD 第 2 項)', () => {
  it('清空既有存檔並寫入符合 GameSaveData Schema 的 INITIAL_GAME_SAVE', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem(STORAGE_KEY, JSON.stringify({ garbage: 'old corrupted save' }));

    const result = executeHardReset(adapter, STORAGE_KEY);

    expect(result).toEqual(INITIAL_GAME_SAVE);

    const persisted = JSON.parse(adapter.getItem(STORAGE_KEY)!);
    expect(persisted).toEqual(INITIAL_GAME_SAVE);
    expect(persisted.driver.money).toBe(1000);
    expect(persisted.pedestrian.money).toBe(0);
    expect(persisted.driver.currentLevel).toBe(1);
    expect(persisted.pedestrian.currentLevel).toBe(1);
  });

  it('對全新（未曾寫入過）的 adapter 呼叫也能正常寫入初始存檔', () => {
    const adapter = new MemoryStorageAdapter();
    executeHardReset(adapter, STORAGE_KEY);
    expect(JSON.parse(adapter.getItem(STORAGE_KEY)!)).toEqual(INITIAL_GAME_SAVE);
  });

  it('駕駛與路人資料在寫回的 JSON 中維持雙軌隔離 (Q19 系列不變原則)', () => {
    const adapter = new MemoryStorageAdapter();
    executeHardReset(adapter, STORAGE_KEY);
    const persisted = JSON.parse(adapter.getItem(STORAGE_KEY)!);

    persisted.driver.money = 999;
    expect(persisted.pedestrian.money).toBe(0); // 不互相干擾
  });
});
