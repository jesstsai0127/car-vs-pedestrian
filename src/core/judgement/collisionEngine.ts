// 核心轉換常數 (§3.2)
const K_HP = 0.5;
const K_DURA = 0.3;
const K_PAYOUT = 10.0;
const K_ARG = 0.05;

const ZONE_FACTOR: Record<'FRONT' | 'SIDE', number> = {
  FRONT: 1.0,
  SIDE: 0.4
};

export interface CalculateCollisionInput {
  impactSpeedMps: number;
  vehicleWeightClass: number;
  impactZone: 'FRONT' | 'SIDE';
  timeDiffTicks: number;
  policeRngValue?: number;
  driverArgLevel: number;
  pedestrianArgLevel: number;
  driverBrakeLevel: number;
  pedestrianDodgeLevel: number;
}

export interface CalculateCollisionOutput {
  impactEnergy: number;
  isAmbiguousZone: boolean;
  pedestrianHpLoss: number;
  vehicleDurabilityLoss: number;
  finalDriverFaultRatio: number;
  payoutAmount: number;
  penaltyAmount: number;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function levelBonus(level: number): number {
  return Math.min((level - 1) * 0.05, 0.5);
}

/**
 * 核心碰撞判決純函數 (§3.5)
 * 嚴禁在此函數內呼叫 DOM、Math.random() 或 localStorage
 */
export function calculateCollision(input: CalculateCollisionInput): CalculateCollisionOutput {
  const impactEnergy = input.impactSpeedMps * input.vehicleWeightClass * ZONE_FACTOR[input.impactZone];

  const pedestrianBodyBonus = levelBonus(input.pedestrianDodgeLevel);
  const driverBrakeBonus = levelBonus(input.driverBrakeLevel);

  const pedestrianHpLoss = Math.floor(impactEnergy * K_HP * (1 - pedestrianBodyBonus));
  const vehicleDurabilityLoss = Math.floor(impactEnergy * K_DURA * (1 - driverBrakeBonus));

  // §3.3：isAmbiguousZone 由函數內部依 timeDiffTicks 自行歸納，呼叫端不傳入此欄位
  const isAmbiguousZone = input.timeDiffTicks >= 58 && input.timeDiffTicks <= 62;

  let faultBase: number;
  if (isAmbiguousZone) {
    faultBase = input.policeRngValue ?? 0.5;
  } else if (input.timeDiffTicks > 62) {
    faultBase = 1.0;
  } else {
    faultBase = 0.0;
  }

  const argAdjustment = (input.pedestrianArgLevel - input.driverArgLevel) * K_ARG;
  const finalDriverFaultRatio = clamp(faultBase + argAdjustment, 0.0, 1.0);

  const payoutBase = impactEnergy * K_PAYOUT;

  let payoutAmount = 0;
  let penaltyAmount = 0;
  if (finalDriverFaultRatio >= 0.5) {
    payoutAmount = Math.floor(payoutBase * finalDriverFaultRatio);
  } else {
    penaltyAmount = Math.floor(payoutBase * (1.0 - finalDriverFaultRatio));
  }

  return {
    impactEnergy,
    isAmbiguousZone,
    pedestrianHpLoss,
    vehicleDurabilityLoss,
    finalDriverFaultRatio,
    payoutAmount,
    penaltyAmount
  };
}
