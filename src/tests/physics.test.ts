import { describe, it, expect } from 'vitest';
import {
  checkAABBCollision,
  updateVehiclePhysics,
  BoundingBox,
  PhysicsState,
  VehicleKinematicsConfig
} from '../core/physics/physics';

const box = (cx: number, cy: number, w: number, h: number): BoundingBox => ({
  center: { x: cx, y: cy },
  width: w,
  height: h
});

describe('checkAABBCollision: AABB 相交檢測 (§9.3.1)', () => {
  it('兩盒完全重疊 -> 相交', () => {
    expect(checkAABBCollision(box(0, 0, 2, 2), box(0, 0, 2, 2))).toBe(true);
  });

  it('兩盒明顯分離 -> 不相交', () => {
    expect(checkAABBCollision(box(0, 0, 2, 2), box(10, 0, 2, 2))).toBe(false);
  });

  it('邊界剛好接觸（距離 = 半寬和）-> 判定為相交（<=）', () => {
    // A 半寬 1, B 半寬 1, 中心距 2 = 1+1
    expect(checkAABBCollision(box(0, 0, 2, 2), box(2, 0, 2, 2))).toBe(true);
  });

  it('X 軸相交但 Y 軸分離 -> 不相交', () => {
    expect(checkAABBCollision(box(0, 0, 2, 2), box(0, 10, 2, 2))).toBe(false);
  });

  it('剛好超過接觸點一點點 -> 不相交', () => {
    expect(checkAABBCollision(box(0, 0, 2, 2), box(2.01, 0, 2, 2))).toBe(false);
  });
});

const config: VehicleKinematicsConfig = {
  maxSpeedMps: 16.67,
  accelerationMps2: 2.5,
  brakePowerMps2: 4.0
};

const stateAt = (x: number, vx: number): PhysicsState => ({
  positionMeter: { x, y: 0 },
  velocityMps: { x: vx, y: 0 },
  accelerationMps2: { x: 0, y: 0 },
  boundingBox: box(x, 0, 4, 2)
});

describe('updateVehiclePhysics: 車輛運動學 (§9.4, §9.5)', () => {
  it('加速時速度增加 v = v0 + a*dt', () => {
    const next = updateVehiclePhysics(stateAt(0, 5), true, false, config, 1);
    // 5 + 2.5*(1/60) = 5.041666...
    expect(next.velocityMps.x).toBeCloseTo(5 + 2.5 / 60, 10);
    expect(next.positionMeter.x).toBeCloseTo(next.velocityMps.x / 60, 10);
  });

  it('煞車時速度下降，且煞車優先於加速 (§12.1 邊界 1)', () => {
    const next = updateVehiclePhysics(stateAt(0, 10), true, true, config, 1);
    expect(next.velocityMps.x).toBeLessThan(10);
  });

  it('brakeLevel 加成套用 §5.1 乘數公式，Level 1 為 1.0x 無加成', () => {
    const lvl1 = updateVehiclePhysics(stateAt(0, 10), false, true, config, 1);
    const lvl6 = updateVehiclePhysics(stateAt(0, 10), false, true, config, 6);
    // Level 6 -> 1 + 5*0.05 = 1.25x，減速更多，速度更低
    expect(lvl6.velocityMps.x).toBeLessThan(lvl1.velocityMps.x);
    // Level 1 精確值：10 - 4.0*1.0*(1/60)
    expect(lvl1.velocityMps.x).toBeCloseTo(10 - 4.0 / 60, 10);
    // Level 6 精確值：10 - 4.0*1.25*(1/60)
    expect(lvl6.velocityMps.x).toBeCloseTo(10 - 5.0 / 60, 10);
  });

  it('速度被 clamp 在 [0, maxSpeed]，不會超過最高速', () => {
    const next = updateVehiclePhysics(stateAt(0, 16.67), true, false, config, 1);
    expect(next.velocityMps.x).toBe(16.67);
  });

  it('速度被 clamp 不會低於 0（煞車到停止後不倒退）', () => {
    const next = updateVehiclePhysics(stateAt(0, 0.01), false, true, config, 1);
    expect(next.velocityMps.x).toBe(0);
  });

  it('無輸入時受滾動摩擦自然減速', () => {
    const next = updateVehiclePhysics(stateAt(0, 5), false, false, config, 1);
    expect(next.velocityMps.x).toBeCloseTo(5 - 0.5 / 60, 10);
  });

  it('無輸入且已靜止時，加速度為 0 不倒退', () => {
    const next = updateVehiclePhysics(stateAt(0, 0), false, false, config, 1);
    expect(next.velocityMps.x).toBe(0);
    expect(next.accelerationMps2.x).toBe(0);
  });

  it('boundingBox 中心跟隨更新後的位置移動', () => {
    const next = updateVehiclePhysics(stateAt(100, 6), true, false, config, 1);
    expect(next.boundingBox.center.x).toBe(next.positionMeter.x);
    expect(next.boundingBox.width).toBe(4); // 尺寸不變
  });
});
