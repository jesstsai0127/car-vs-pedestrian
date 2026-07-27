// §A.1 定案：局內物理與碰撞推進純函數（每 Tick 60FPS 調用），不維護可變內部狀態。

export interface PhysicsEntity {
  id: string;
  x: number;      // 縱向位置 (m)
  y: number;      // 橫向位置 (m)
  width: number;  // 寬度 (m)
  height: number; // 長度 (m)
  vx: number;     // 縱向速度 (m/s)
  vy: number;     // 橫向速度 (m/s)
}

export interface LevelSimulationState {
  currentTick: number;
  vehicle: PhysicsEntity;
  pedestrian: PhysicsEntity;
  pedestrianJumpTick: number | null;
  isCollided: boolean;
  collisionZone: 'FRONT' | 'SIDE' | null;
}

export interface LevelSimulationInput {
  isAccelerating: boolean;
  isBraking: boolean;
  isSteeringLeft: boolean;
  isSteeringRight: boolean;
  isPedestrianJump: boolean;
}

export interface SimVehicleConfig {
  acceleration: number;
  brakePower: number;
  maxSpeedMps: number;
}

/**
 * 局內物理與碰撞 AABB 推進純函數 (§A.1)
 */
export function stepLevelSimulation(
  state: LevelSimulationState,
  input: LevelSimulationInput,
  vehicleConfig: SimVehicleConfig,
  dtSeconds: number = 1 / 60
): LevelSimulationState {
  if (state.isCollided) return state; // 已碰撞則凍結

  // 1. 車輛縱向速度與位置
  let newVx = state.vehicle.vx;
  if (input.isAccelerating) {
    newVx = Math.min(vehicleConfig.maxSpeedMps, newVx + vehicleConfig.acceleration * dtSeconds);
  } else if (input.isBraking) {
    newVx = Math.max(0, newVx - vehicleConfig.brakePower * dtSeconds);
  } else {
    newVx = Math.max(0, newVx - 1.0 * dtSeconds); // 自然阻力
  }
  const newVehX = state.vehicle.x + newVx * dtSeconds;

  // 2. 路人狀態與位移
  let newPedJumpTick = state.pedestrianJumpTick;
  let newPedY = state.pedestrian.y;
  if (input.isPedestrianJump && newPedJumpTick === null) {
    newPedJumpTick = state.currentTick;
  }
  if (newPedJumpTick !== null) {
    newPedY += 3.0 * dtSeconds; // 跳出後橫向衝入車道 (3 m/s)
  }

  // 3. AABB 碰撞檢測與撞擊區域判定 (FRONT vs SIDE)
  const veh = { ...state.vehicle, x: newVehX };
  const ped = { ...state.pedestrian, y: newPedY };

  const isAABBOverlap =
    Math.abs(veh.x - ped.x) < (veh.height + ped.height) / 2 &&
    Math.abs(veh.y - ped.y) < (veh.width + ped.width) / 2;

  let collisionZone: 'FRONT' | 'SIDE' | null = null;
  if (isAABBOverlap) {
    const relativeX = ped.x - veh.x;
    collisionZone = relativeX > veh.height * 0.2 ? 'FRONT' : 'SIDE';
  }

  return {
    currentTick: state.currentTick + 1,
    vehicle: { ...veh, vx: newVx },
    pedestrian: { ...ped, y: newPedY },
    pedestrianJumpTick: newPedJumpTick,
    isCollided: isAABBOverlap,
    collisionZone
  };
}
