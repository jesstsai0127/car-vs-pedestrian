import { describe, it, expect } from 'vitest';
import { validatePreGameAccess } from '../core/progression/preGameCheck';

const repairCostConfig = { repairCostPerHp: 5 };

describe('validatePreGameAccess: 駕駛模式 HP 門檻 (§4.2, §12.3)', () => {
  it('HP 精確等於 50 時直接通過，不扣款 (邊界壓線)', () => {
    const check = validatePreGameAccess({ role: 'DRIVER', hp: 50, money: 0, repairConfig: repairCostConfig });
    expect(check.canPass).toBe(true);
    expect(check.deductedMoney).toBe(0);
    expect(check.repairedHp).toBe(50);
    expect(check.triggerBankrupt).toBe(false);
  });

  it('HP 高於 50 時直接通過，不觸發修復', () => {
    const check = validatePreGameAccess({ role: 'DRIVER', hp: 80, money: 0, repairConfig: repairCostConfig });
    expect(check.canPass).toBe(true);
    expect(check.deductedMoney).toBe(0);
    expect(check.repairedHp).toBe(80);
  });

  it('HP 低於 50 且金錢足夠時，強制修復至 50（非 100）並扣款', () => {
    // (50-30)*5 = 100
    const check = validatePreGameAccess({ role: 'DRIVER', hp: 30, money: 200, repairConfig: repairCostConfig });
    expect(check.canPass).toBe(true);
    expect(check.deductedMoney).toBe(100);
    expect(check.repairedHp).toBe(50);
    expect(check.remainingMoney).toBe(100);
    expect(check.triggerBankrupt).toBe(false);
  });

  it('HP 等於 49 且金錢不足支付 1 HP 修復費時，觸發破產重置 (§12.3 邊界 4)', () => {
    const check = validatePreGameAccess({ role: 'DRIVER', hp: 49, money: 0, repairConfig: repairCostConfig });
    expect(check.canPass).toBe(false);
    expect(check.triggerBankrupt).toBe(true);
  });

  it('金錢剛好等於修復費用時，應視為足夠 (邊界)', () => {
    // (50-40)*5 = 50
    const check = validatePreGameAccess({ role: 'DRIVER', hp: 40, money: 50, repairConfig: repairCostConfig });
    expect(check.canPass).toBe(true);
    expect(check.deductedMoney).toBe(50);
    expect(check.remainingMoney).toBe(0);
    expect(check.triggerBankrupt).toBe(false);
  });

  it('未提供 repairConfig 時視為修復單價 0，不扣款即可修復至 50', () => {
    const check = validatePreGameAccess({ role: 'DRIVER', hp: 30, money: 0 });
    expect(check.canPass).toBe(true);
    expect(check.deductedMoney).toBe(0);
    expect(check.repairedHp).toBe(50);
  });

  it('金錢不足以修復時，不扣款，維持原始 HP 與金錢', () => {
    const check = validatePreGameAccess({ role: 'DRIVER', hp: 10, money: 50, repairConfig: repairCostConfig });
    expect(check.canPass).toBe(false);
    expect(check.deductedMoney).toBe(0);
    expect(check.repairedHp).toBe(10);
    expect(check.remainingMoney).toBe(50);
    expect(check.triggerBankrupt).toBe(true);
    expect(check.failedReason).toBeDefined();
  });
});

describe('validatePreGameAccess: 路人模式資產門檻 (§2.2.2, Q19.4)', () => {
  it('資產達到門檻時允許進入，不扣款、不懲罰', () => {
    const check = validatePreGameAccess({ role: 'PEDESTRIAN', hp: 100, money: 500, accessMoneyThreshold: 300 });
    expect(check.canPass).toBe(true);
    expect(check.deductedMoney).toBe(0);
    expect(check.remainingMoney).toBe(500);
    expect(check.triggerBankrupt).toBe(false);
  });

  it('資產不足門檻時僅阻擋進入，不扣款也不觸發破產 (v2 拿掉 5% 懲罰)', () => {
    const check = validatePreGameAccess({ role: 'PEDESTRIAN', hp: 100, money: 100, accessMoneyThreshold: 300 });
    expect(check.canPass).toBe(false);
    expect(check.deductedMoney).toBe(0);
    expect(check.remainingMoney).toBe(100);
    expect(check.triggerBankrupt).toBe(false);
    expect(check.failedReason).toBeDefined();
  });

  it('資產精確等於門檻時應視為通過（邊界）', () => {
    const check = validatePreGameAccess({ role: 'PEDESTRIAN', hp: 100, money: 300, accessMoneyThreshold: 300 });
    expect(check.canPass).toBe(true);
  });

  it('未提供 accessMoneyThreshold 時視為無門檻，直接通過', () => {
    const check = validatePreGameAccess({ role: 'PEDESTRIAN', hp: 100, money: 0 });
    expect(check.canPass).toBe(true);
  });
});
