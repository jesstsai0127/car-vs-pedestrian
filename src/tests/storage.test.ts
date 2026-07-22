import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../core/storage/StorageAdapter';
import { INITIAL_GAME_SAVE } from '../core/storage/saveSchema';
import { computeHardResetState } from '../core/progression/saveModel';

describe('MemoryStorageAdapter: IStorageAdapter 記憶體實作 (§13.5)', () => {
  it('setItem 後 getItem 可以讀回相同的值', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem('KEY', 'VALUE');
    expect(adapter.getItem('KEY')).toBe('VALUE');
  });

  it('未寫入的 key 讀取回傳 null', () => {
    const adapter = new MemoryStorageAdapter();
    expect(adapter.getItem('NOT_EXIST')).toBeNull();
  });

  it('removeItem 移除單一 key', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem('A', '1');
    adapter.setItem('B', '2');
    adapter.removeItem('A');
    expect(adapter.getItem('A')).toBeNull();
    expect(adapter.getItem('B')).toBe('2');
  });

  it('clear 清空所有已儲存的資料', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem('A', '1');
    adapter.setItem('B', '2');
    adapter.clear();
    expect(adapter.getItem('A')).toBeNull();
    expect(adapter.getItem('B')).toBeNull();
  });

  it('setItem 對既有 key 覆寫舊值', () => {
    const adapter = new MemoryStorageAdapter();
    adapter.setItem('A', '1');
    adapter.setItem('A', '2');
    expect(adapter.getItem('A')).toBe('2');
  });
});

describe('computeHardResetState: 純函數硬重置狀態計算 (§5.3 Q20.6)', () => {
  it('回傳的內容與 INITIAL_GAME_SAVE 深度相等', () => {
    const result = computeHardResetState();
    expect(result).toEqual(INITIAL_GAME_SAVE);
  });

  it('回傳新物件，修改結果不應影響共用的 INITIAL_GAME_SAVE 常數', () => {
    const result = computeHardResetState();
    result.driver.money = 999999;
    result.driver.stats.brakeLevel = 999;

    expect(INITIAL_GAME_SAVE.driver.money).toBe(1000);
    expect(INITIAL_GAME_SAVE.driver.stats.brakeLevel).toBe(1);
  });

  it('每次呼叫都回傳獨立的物件（不同次呼叫互不影響）', () => {
    const first = computeHardResetState();
    const second = computeHardResetState();
    first.pedestrian.money = 12345;

    expect(second.pedestrian.money).toBe(0);
  });
});
