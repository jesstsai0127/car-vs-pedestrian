import { describe, it, expect } from 'vitest';
import {
  stepLevelSimulation,
  LevelSimulationState,
  LevelSimulationInput,
  SimVehicleConfig
} from '../core/engine/LevelSimulator';

const cfg: SimVehicleConfig = { acceleration: 4, brakePower: 6, maxSpeedMps: 22 };
const noInput: LevelSimulationInput = {
  isAccelerating: false, isBraking: false, isSteeringLeft: false, isSteeringRight: false, isPedestrianJump: false
};

const baseState = (over: Partial<LevelSimulationState> = {}): LevelSimulationState => ({
  currentTick: 0,
  vehicle: { id: 'v', x: 0, y: 0, width: 1.9, height: 4.2, vx: 10, vy: 0 },
  pedestrian: { id: 'p', x: 100, y: 3.4, width: 0.6, height: 0.6, vx: 0, vy: 0 },
  pedestrianJumpTick: null,
  isCollided: false,
  collisionZone: null,
  ...over
});

describe('stepLevelSimulation: 車輛物理 (§A.1)', () => {
  it('加速時 vx 增加並在 maxSpeedMps 封頂', () => {
    const s = stepLevelSimulation(baseState({ vehicle: { id: 'v', x: 0, y: 0, width: 1.9, height: 4.2, vx: 21.99, vy: 0 } }),
      { ...noInput, isAccelerating: true }, cfg);
    expect(s.vehicle.vx).toBe(22);
  });

  it('煞車時 vx 下降並在 0 封底', () => {
    const s = stepLevelSimulation(baseState({ vehicle: { id: 'v', x: 0, y: 0, width: 1.9, height: 4.2, vx: 0.01, vy: 0 } }),
      { ...noInput, isBraking: true }, cfg);
    expect(s.vehicle.vx).toBe(0);
  });

  it('無輸入時受自然阻力減速', () => {
    const s = stepLevelSimulation(baseState(), noInput, cfg);
    expect(s.vehicle.vx).toBeCloseTo(10 - 1.0 / 60, 10);
  });

  it('位置依速度前進，tick +1', () => {
    const s = stepLevelSimulation(baseState(), { ...noInput, isAccelerating: true }, cfg);
    expect(s.vehicle.x).toBeGreaterThan(0);
    expect(s.currentTick).toBe(1);
  });

  it('已碰撞時凍結，state 原樣回傳', () => {
    const collided = baseState({ isCollided: true });
    expect(stepLevelSimulation(collided, { ...noInput, isAccelerating: true }, cfg)).toBe(collided);
  });
});

describe('stepLevelSimulation: 路人跳出 (§A.1)', () => {
  it('首次 isPedestrianJump 記錄 jumpTick，且不被後續覆蓋', () => {
    const s1 = stepLevelSimulation(baseState({ currentTick: 30 }), { ...noInput, isPedestrianJump: true }, cfg);
    expect(s1.pedestrianJumpTick).toBe(30);
    const s2 = stepLevelSimulation({ ...s1 }, { ...noInput, isPedestrianJump: true }, cfg);
    expect(s2.pedestrianJumpTick).toBe(30); // 不覆蓋
  });

  it('跳出後路人 y 以 3 m/s 橫向增加', () => {
    const s = stepLevelSimulation(baseState({ pedestrianJumpTick: 0 }), noInput, cfg);
    expect(s.pedestrian.y).toBeCloseTo(3.4 + 3.0 / 60, 10);
  });

  it('未跳出時路人 y 不動', () => {
    const s = stepLevelSimulation(baseState(), noInput, cfg);
    expect(s.pedestrian.y).toBe(3.4);
  });
});

describe('stepLevelSimulation: AABB 碰撞與撞擊區域 (§A.1)', () => {
  it('分離時不碰撞', () => {
    const s = stepLevelSimulation(baseState(), noInput, cfg);
    expect(s.isCollided).toBe(false);
    expect(s.collisionZone).toBeNull();
  });

  it('重疊時碰撞，車頭前方判 FRONT', () => {
    // 車 vx=10 → 該 tick 前進至 x≈0.167；height*0.2=0.84。
    // 路人 x=2（relativeX≈1.83 > 0.84）y=0 與車重疊 → FRONT
    const s = stepLevelSimulation(
      baseState({ pedestrian: { id: 'p', x: 2, y: 0, width: 0.6, height: 0.6, vx: 0, vy: 0 } }),
      noInput, cfg
    );
    expect(s.isCollided).toBe(true);
    expect(s.collisionZone).toBe('FRONT');
  });

  it('重疊但相對位置在車身側邊判 SIDE', () => {
    // 路人 x=0（relativeX=0 <= 0.84）→ SIDE
    const s = stepLevelSimulation(
      baseState({ pedestrian: { id: 'p', x: 0, y: 0, width: 0.6, height: 0.6, vx: 0, vy: 0 } }),
      noInput, cfg
    );
    expect(s.isCollided).toBe(true);
    expect(s.collisionZone).toBe('SIDE');
  });
});
