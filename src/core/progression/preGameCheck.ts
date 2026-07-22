// §4.2 戰前檢查純函數 (Q20.3 定案：函數名稱 validatePreGameAccess，強制修復目標為 50 HP)

export interface RepairCostConfig {
  repairCostPerHp: number;
}

export interface PreGameAccessInput {
  role: 'DRIVER' | 'PEDESTRIAN';
  money: number;
  hp: number;
  repairConfig?: RepairCostConfig;
  accessMoneyThreshold?: number;
}

export interface PreGameAccessResult {
  canPass: boolean;
  deductedMoney: number;
  repairedHp: number;
  remainingMoney: number;
  triggerBankrupt: boolean;
  failedReason?: string;
}

const REPAIR_TARGET_HP = 50;

export function validatePreGameAccess(input: PreGameAccessInput): PreGameAccessResult {
  if (input.role === 'PEDESTRIAN') {
    const threshold = input.accessMoneyThreshold ?? 0;
    if (input.money < threshold) {
      return {
        canPass: false,
        deductedMoney: 0,
        repairedHp: input.hp,
        remainingMoney: input.money,
        triggerBankrupt: false,
        failedReason: `資產不足，需要至少 $${threshold} 才能進入此場景`
      };
    }
    return {
      canPass: true,
      deductedMoney: 0,
      repairedHp: input.hp,
      remainingMoney: input.money,
      triggerBankrupt: false
    };
  }

  // DRIVER 路線
  if (input.hp >= REPAIR_TARGET_HP) {
    return {
      canPass: true,
      deductedMoney: 0,
      repairedHp: input.hp,
      remainingMoney: input.money,
      triggerBankrupt: false
    };
  }

  const repairCostPerHp = input.repairConfig?.repairCostPerHp ?? 0;
  const cost = (REPAIR_TARGET_HP - input.hp) * repairCostPerHp;

  if (input.money >= cost) {
    return {
      canPass: true,
      deductedMoney: cost,
      repairedHp: REPAIR_TARGET_HP,
      remainingMoney: input.money - cost,
      triggerBankrupt: false
    };
  }

  return {
    canPass: false,
    deductedMoney: 0,
    repairedHp: input.hp,
    remainingMoney: input.money,
    triggerBankrupt: true,
    failedReason: '資產不足以將車輛/身體修復至 50 HP，強制破產重置'
  };
}
