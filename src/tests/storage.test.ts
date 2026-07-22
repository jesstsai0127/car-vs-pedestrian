import { describe, it, expect } from 'vitest';
import { MemoryStorageAdapter } from '../core/storage/StorageAdapter';
import { INITIAL_GAME_SAVE } from '../core/storage/saveSchema';
import { computeHardResetState, validateAndMigrateSaveData } from '../core/progression/saveModel';

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

describe('validateAndMigrateSaveData: 存檔遷移純函數 (§13.4 / Q23.1)', () => {
  const NOW = 1_700_000_000_000;

  it('rawData 非物件（null）時回傳初始存檔，並填入注入的時間戳', () => {
    const r = validateAndMigrateSaveData(null, NOW);
    expect(r.driver.money).toBe(1000);
    expect(r.pedestrian.money).toBe(0);
    expect(r.lastSavedTimestamp).toBe(NOW);
  });

  it('rawData 為非物件原始值（字串）時同樣回退初始存檔', () => {
    const r = validateAndMigrateSaveData('corrupted', NOW);
    expect(r).toMatchObject({ version: '1.0.0', lastSavedTimestamp: NOW });
  });

  it('完整合法存檔的欄位被保留', () => {
    const valid = JSON.parse(JSON.stringify(INITIAL_GAME_SAVE));
    valid.driver.money = 555;
    valid.activeRole = 'PEDESTRIAN';
    valid.lastSavedTimestamp = 999;
    const r = validateAndMigrateSaveData(valid, NOW);
    expect(r.driver.money).toBe(555);
    expect(r.activeRole).toBe('PEDESTRIAN');
    expect(r.lastSavedTimestamp).toBe(999); // 既有時間戳保留，不覆蓋
  });

  it('缺 lastSavedTimestamp 時填入注入時間戳', () => {
    const r = validateAndMigrateSaveData({ driver: { money: 10 } }, NOW);
    expect(r.lastSavedTimestamp).toBe(NOW);
  });

  it('vehicleHp / hp 超界時 clamp 到 [0,100]', () => {
    const r1 = validateAndMigrateSaveData({ driver: { vehicleHp: 999 }, pedestrian: { hp: -50 } }, NOW);
    expect(r1.driver.vehicleHp).toBe(100);
    expect(r1.pedestrian.hp).toBe(0);
  });

  it('currentLevel / stats 低於 1 時保底為 1', () => {
    const r = validateAndMigrateSaveData(
      { driver: { currentLevel: 0, stats: { brakeLevel: 0 } }, pedestrian: { currentLevel: -3 } },
      NOW
    );
    expect(r.driver.currentLevel).toBe(1);
    expect(r.driver.stats.brakeLevel).toBe(1);
    expect(r.pedestrian.currentLevel).toBe(1);
  });

  it('unlockedVehicleIds 非陣列時回退預設', () => {
    const r = validateAndMigrateSaveData({ driver: { unlockedVehicleIds: 'nope' } }, NOW);
    expect(r.driver.unlockedVehicleIds).toEqual(['default_sedan']);
  });

  it('unlockedVehicleIds 為陣列時保留', () => {
    const r = validateAndMigrateSaveData({ driver: { unlockedVehicleIds: ['a', 'b'] } }, NOW);
    expect(r.driver.unlockedVehicleIds).toEqual(['a', 'b']);
  });

  it('activeRole 非 PEDESTRIAN 一律回退 DRIVER', () => {
    expect(validateAndMigrateSaveData({ activeRole: 'GARBAGE' }, NOW).activeRole).toBe('DRIVER');
  });

  it('money 非數字時回退預設值', () => {
    const r = validateAndMigrateSaveData({ driver: { money: 'x' }, pedestrian: { money: null } }, NOW);
    expect(r.driver.money).toBe(1000);
    expect(r.pedestrian.money).toBe(0);
  });

  it('缺 levelRecords 時回退為初始，且不共用參照（深拷貝隔離）', () => {
    const r = validateAndMigrateSaveData({}, NOW);
    r.driver.levelRecords[1].playCount = 99;
    expect(INITIAL_GAME_SAVE.driver.levelRecords[1].playCount).toBe(0);
  });
});
