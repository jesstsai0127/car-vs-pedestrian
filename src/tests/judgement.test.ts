import { describe, it, expect } from 'vitest';
import { calculateCollision } from '../core/judgement/collisionEngine';

const baseInput = {
  impactSpeedMps: 10.0,
  vehicleWeightClass: 1.0,
  impactZone: 'FRONT' as const,
  driverArgLevel: 1,
  pedestrianArgLevel: 1,
  driverBrakeLevel: 1,
  pedestrianDodgeLevel: 1
};

describe('collisionEngine: E_impact 衝擊能量公式 (§3.1)', () => {
  it('E_impact = V * W * A_zone，FRONT 撞擊係數為 1.0', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 10.0, vehicleWeightClass: 1.0, impactZone: 'FRONT', timeDiffTicks: 57 });
    expect(output.impactEnergy).toBe(10.0);
  });

  it('SIDE 撞擊係數為 0.4', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 10.0, vehicleWeightClass: 1.0, impactZone: 'SIDE', timeDiffTicks: 57 });
    expect(output.impactEnergy).toBe(4.0);
  });

  it('車重係數 1.8 (卡車) 正確放大衝擊能量', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 10.0, vehicleWeightClass: 1.8, impactZone: 'FRONT', timeDiffTicks: 57 });
    expect(output.impactEnergy).toBe(18.0);
  });

  it('車速為 0 時，E_impact 與所有下游結果皆為 0 (§12.1 邊界 4)', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 0.0, timeDiffTicks: 57 });
    expect(output.impactEnergy).toBe(0);
    expect(output.pedestrianHpLoss).toBe(0);
    expect(output.vehicleDurabilityLoss).toBe(0);
    expect(output.payoutAmount).toBe(0);
    expect(output.penaltyAmount).toBe(0);
  });
});

describe('collisionEngine: HP / 車損扣減公式 (§3.1, §3.2)', () => {
  it('HP_loss = floor(E * K_hp * (1 - P_body_bonus))，Level 1 無減傷', () => {
    // E = 20 * 1.0 * 1.0 = 20, K_hp = 0.5 -> 10.0 -> floor = 10
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 20.0, timeDiffTicks: 57 });
    expect(output.pedestrianHpLoss).toBe(10);
  });

  it('路人 dodgeLevel 減傷加成正確套用', () => {
    // dodgeLevel=6 -> bonus = (6-1)*0.05 = 0.25 -> HP_loss = floor(20*0.5*0.75) = floor(7.5) = 7
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 20.0, pedestrianDodgeLevel: 6, timeDiffTicks: 57 });
    expect(output.pedestrianHpLoss).toBe(7);
  });

  it('dodgeLevel 減傷加成上限為 50%，不因等級超高而突破', () => {
    // dodgeLevel=20 -> 理論值 (20-1)*0.05=0.95，須 clamp 至 0.5
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 20.0, pedestrianDodgeLevel: 20, timeDiffTicks: 57 });
    expect(output.pedestrianHpLoss).toBe(5); // floor(20*0.5*0.5) = 5
  });

  it('Vehicle_loss = floor(E * K_dura * (1 - D_dr_bonus))，brakeLevel 減免正確套用', () => {
    // E=20, K_dura=0.3 -> 6.0；brakeLevel=1 -> bonus=0 -> floor(6.0)=6
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 20.0, timeDiffTicks: 57 });
    expect(output.vehicleDurabilityLoss).toBe(6);
  });

  it('driverBrakeLevel 車損減免上限為 50%', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 20.0, driverBrakeLevel: 20, timeDiffTicks: 57 });
    expect(output.vehicleDurabilityLoss).toBe(3); // floor(20*0.3*0.5) = 3
  });
});

describe('collisionEngine: 責任判定邊界 (§3.3, §12.2, §12.4)', () => {
  it('邊界 1：timeDiffTicks = 57 (灰色區間下界之外) 應判決駕駛 0% 責任', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 15.0, timeDiffTicks: 57 });

    expect(output.isAmbiguousZone).toBe(false);
    expect(output.finalDriverFaultRatio).toBe(0.0);
    expect(output.payoutAmount).toBe(0);
    expect(output.penaltyAmount).toBeGreaterThan(0);
  });

  it('邊界 2：timeDiffTicks = 63 (灰色區間上界之外) 應判決駕駛 100% 責任', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 15.0, timeDiffTicks: 63 });

    expect(output.isAmbiguousZone).toBe(false);
    expect(output.finalDriverFaultRatio).toBe(1.0);
    expect(output.payoutAmount).toBeGreaterThan(0);
    expect(output.penaltyAmount).toBe(0);
  });

  it('灰色區間邊界剛好 58 與 62 兩端點皆判定為 isAmbiguousZone = true', () => {
    const lower = calculateCollision({ ...baseInput, impactSpeedMps: 15.0, timeDiffTicks: 58, policeRngValue: 0.2 });
    const upper = calculateCollision({ ...baseInput, impactSpeedMps: 15.0, timeDiffTicks: 62, policeRngValue: 0.2 });
    expect(lower.isAmbiguousZone).toBe(true);
    expect(upper.isAmbiguousZone).toBe(true);
  });

  it('邊界 3：黃燈區間 (timeDiffTicks = 60) 應信任傳入之 policeRngValue，而非寫死判定', () => {
    const zeroFault = calculateCollision({ ...baseInput, impactSpeedMps: 15.0, timeDiffTicks: 60, policeRngValue: 0.0 });
    const midFault = calculateCollision({ ...baseInput, impactSpeedMps: 15.0, timeDiffTicks: 60, policeRngValue: 0.42 });

    expect(zeroFault.isAmbiguousZone).toBe(true);
    expect(zeroFault.finalDriverFaultRatio).toBe(0.0);
    expect(midFault.isAmbiguousZone).toBe(true);
    expect(midFault.finalDriverFaultRatio).toBe(0.42);
  });

  it('邊界 3b：黃燈區間缺少 policeRngValue 時保底為 0.5', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 15.0, timeDiffTicks: 60 });

    expect(output.isAmbiguousZone).toBe(true);
    expect(output.finalDriverFaultRatio).toBe(0.5);
  });

  it('邊界 4：辯解修正值溢位時應正確 Clamp 在 [0.0, 1.0] 上界', () => {
    const output = calculateCollision({
      ...baseInput,
      impactSpeedMps: 10.0,
      timeDiffTicks: 65,
      pedestrianArgLevel: 10 // (10-1)*0.05 = 0.45 -> 1.0 + 0.45 = 1.45 -> clamp 1.0
    });
    expect(output.finalDriverFaultRatio).toBe(1.0);
  });

  it('邊界 4b：辯解修正值溢位時應正確 Clamp 在 [0.0, 1.0] 下界', () => {
    const output = calculateCollision({
      ...baseInput,
      impactSpeedMps: 10.0,
      timeDiffTicks: 57,
      driverArgLevel: 10 // Fault_base=0.0 - (10-1)*0.05 = -0.45 -> clamp 0.0
    });
    expect(output.finalDriverFaultRatio).toBe(0.0);
  });

  it('辯解等級差正確調整責任比率（非溢位情況）', () => {
    // Fault_base = 1.0 (ticks=63), pedestrianArgLevel=1, driverArgLevel=3
    // (P_arg - D_arg)*0.05 = (1-3)*0.05 = -0.10 -> 1.0-0.10=0.90
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 10.0, timeDiffTicks: 63, driverArgLevel: 3 });
    expect(output.finalDriverFaultRatio).toBeCloseTo(0.9, 10);
  });
});

describe('collisionEngine: Payout / Penalty 單向互斥與取整規則 (§3.4, §12.3)', () => {
  it('Fault_driver >= 0.5 時，駕駛付款、路人免罰款', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 10.0, timeDiffTicks: 60, policeRngValue: 0.5 });
    expect(output.finalDriverFaultRatio).toBe(0.5);
    expect(output.payoutAmount).toBeGreaterThan(0);
    expect(output.penaltyAmount).toBe(0);
  });

  it('Fault_driver < 0.5 時，路人付罰款、駕駛免賠償', () => {
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 10.0, timeDiffTicks: 60, policeRngValue: 0.49 });
    expect(output.payoutAmount).toBe(0);
    expect(output.penaltyAmount).toBeGreaterThan(0);
  });

  it('所有金額輸出必須為無條件捨去之整數，不得出現小數', () => {
    // E = 7 * 1.0 * 1.0 = 7, Payout_base = 70, Fault=1.0 -> Payout = 70 (整數本身不夠嚴謹，換一個會產生小數的案例)
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 7.3, timeDiffTicks: 63 });
    // E = 7.3, Payout_base = 73 -> floor(73*1.0) = 73，仍為整數；改用會產生小數尾端的速度
    expect(Number.isInteger(output.payoutAmount)).toBe(true);
    expect(Number.isInteger(output.penaltyAmount)).toBe(true);
    expect(Number.isInteger(output.pedestrianHpLoss)).toBe(true);
    expect(Number.isInteger(output.vehicleDurabilityLoss)).toBe(true);
  });

  it('取整規則：非整除速度值仍正確無條件捨去', () => {
    // impactSpeedMps=11.1, weight=1.3 -> E = 14.43, K_payout=10 -> Payout_base=144.3, Fault=1.0 -> floor(144.3)=144
    const output = calculateCollision({ ...baseInput, impactSpeedMps: 11.1, vehicleWeightClass: 1.3, timeDiffTicks: 63 });
    expect(output.payoutAmount).toBe(144);
  });
});
