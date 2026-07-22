// §9.5 物理系統純函數：AABB 碰撞檢測與車輛歐拉積分運動學

export interface Vector2D {
  x: number; // 縱向距離 (公尺)
  y: number; // 橫向距離 (公尺)
}

export interface BoundingBox {
  center: Vector2D;
  width: number;  // X 軸向寬度/長度 (公尺)
  height: number; // Y 軸向高度/寬度 (公尺)
}

export interface PhysicsState {
  positionMeter: Vector2D;
  velocityMps: Vector2D;
  accelerationMps2: Vector2D;
  boundingBox: BoundingBox;
}

export interface VehicleKinematicsConfig {
  maxSpeedMps: number;
  accelerationMps2: number;
  brakePowerMps2: number;
}

const FRICTION_DECEL_MPS2 = 0.5; // §9.4 自然滾動摩擦

/**
 * 純函數：檢查兩個 AABB 包圍盒是否相交 (§9.3.1)
 */
export function checkAABBCollision(a: BoundingBox, b: BoundingBox): boolean {
  const halfWidthA = a.width / 2;
  const halfWidthB = b.width / 2;
  const halfHeightA = a.height / 2;
  const halfHeightB = b.height / 2;

  const deltaX = Math.abs(a.center.x - b.center.x);
  const deltaY = Math.abs(a.center.y - b.center.y);

  return deltaX <= halfWidthA + halfWidthB && deltaY <= halfHeightA + halfHeightB;
}

/**
 * 純函數：更新一 Tick 的車輛運動學狀態 (§9.4, §9.5)
 * 煞車加成採 §5.1 定案乘數公式：1 + (brakeLevel - 1) * 0.05
 */
export function updateVehiclePhysics(
  currentState: PhysicsState,
  isAccelerating: boolean,
  isBraking: boolean,
  vehicleConfig: VehicleKinematicsConfig,
  brakeLevel: number,
  deltaSeconds: number = 1 / 60
): PhysicsState {
  let targetAcc: number;

  // 煞車絕對優先權 (§9.4, §12.1 邊界 1)
  if (isBraking) {
    const brakeBonus = 1 + (brakeLevel - 1) * 0.05;
    targetAcc = -vehicleConfig.brakePowerMps2 * brakeBonus;
  } else if (isAccelerating) {
    targetAcc = vehicleConfig.accelerationMps2;
  } else {
    // 滾動摩擦自然減速（靜止時不再往負向加速）
    targetAcc = currentState.velocityMps.x > 0 ? -FRICTION_DECEL_MPS2 : 0;
  }

  let nextVx = currentState.velocityMps.x + targetAcc * deltaSeconds;
  nextVx = Math.max(0, Math.min(vehicleConfig.maxSpeedMps, nextVx));

  const nextX = currentState.positionMeter.x + nextVx * deltaSeconds;

  return {
    positionMeter: { x: nextX, y: currentState.positionMeter.y },
    velocityMps: { x: nextVx, y: 0 },
    accelerationMps2: { x: targetAcc, y: 0 },
    boundingBox: {
      center: { x: nextX, y: currentState.positionMeter.y },
      width: currentState.boundingBox.width,
      height: currentState.boundingBox.height
    }
  };
}
