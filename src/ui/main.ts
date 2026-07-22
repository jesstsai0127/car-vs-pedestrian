// 最小可玩垂直切片：top-down 駕駛視角，串接已測過的核心純函數。
// 目的：讓「1 秒責任線」機制真的能在手機/PC 上開起來玩，非規格完整的偽 3D HUD。

import { updateVehiclePhysics, checkAABBCollision, PhysicsState, BoundingBox } from '../core/physics/physics';
import { calculateCollision, CalculateCollisionOutput } from '../core/judgement/collisionEngine';
import { GameFSM } from '../core/engine/GameFSM';

const PX_PER_M = 22;                 // §9.2.3 比例尺（略放大以利手機觀看）
const DT = 1 / 60;                   // 固定步長
const LANE_HALF = 1.75;              // 車道半寬 (m)，§9.2.2
const PED_ENTRY_Y = LANE_HALF;       // 路人踏入車道邊界
const VEHICLE = { maxSpeedMps: 22, accelerationMps2: 4.0, brakePowerMps2: 6.0 };

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;

function resize() {
  canvas.width = window.innerWidth * devicePixelRatio;
  canvas.height = window.innerHeight * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
}
window.addEventListener('resize', resize);
resize();

type Phase = 'DRIVING' | 'FROZEN' | 'VERDICT' | 'SAFE';

interface World {
  fsm: GameFSM;
  tick: number;
  car: PhysicsState;
  pedX: number;
  pedY: number;
  pedJumping: boolean;
  pedEntryTick: number | null;
  collisionTick: number | null;
  freezeTicks: number;
  phase: Phase;
  verdict: CalculateCollisionOutput | null;
}

function carBox(x: number, y: number): BoundingBox {
  return { center: { x, y }, width: 4.2, height: 1.9 };
}
function pedBox(x: number, y: number): BoundingBox {
  return { center: { x, y }, width: 0.6, height: 0.6 };
}

function newWorld(): World {
  const fsm = new GameFSM('IN_GAME_RUNNING');
  return {
    fsm,
    tick: 0,
    car: {
      positionMeter: { x: 0, y: 0 },
      velocityMps: { x: 8, y: 0 },
      accelerationMps2: { x: 0, y: 0 },
      boundingBox: carBox(0, 0)
    },
    pedX: 55,
    pedY: 3.4,
    pedJumping: false,
    pedEntryTick: null,
    collisionTick: null,
    freezeTicks: 0,
    phase: 'DRIVING',
    verdict: null
  };
}

let world = newWorld();

// ---- 輸入：鍵盤 + 螢幕觸控區 ----
const input = { accel: false, brake: false };
const btnAccel = { x: 0, y: 0, r: 0 };
const btnBrake = { x: 0, y: 0, r: 0 };

function layoutButtons() {
  const w = window.innerWidth, h = window.innerHeight;
  const r = Math.min(w, h) * 0.11;
  btnAccel.r = btnBrake.r = r;
  btnAccel.x = w - r - 30; btnAccel.y = h - r - 30;
  btnBrake.x = r + 30;     btnBrake.y = h - r - 30;
}
layoutButtons();
window.addEventListener('resize', layoutButtons);

window.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') input.accel = true;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === ' ') input.brake = true;
  if (e.key === 'r') world = newWorld();
});
window.addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') input.accel = false;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === ' ') input.brake = false;
});

function hit(bx: { x: number; y: number; r: number }, px: number, py: number) {
  return Math.hypot(px - bx.x, py - bx.y) <= bx.r * 1.3;
}
const activeTouches = new Map<number, 'accel' | 'brake' | 'restart'>();
function onPointer(e: PointerEvent, down: boolean) {
  e.preventDefault();
  const px = e.clientX, py = e.clientY;
  if (down) {
    if (world.phase === 'VERDICT' || world.phase === 'SAFE') { world = newWorld(); return; }
    if (hit(btnAccel, px, py)) { activeTouches.set(e.pointerId, 'accel'); input.accel = true; }
    else if (hit(btnBrake, px, py)) { activeTouches.set(e.pointerId, 'brake'); input.brake = true; }
  } else {
    const which = activeTouches.get(e.pointerId);
    if (which === 'accel') input.accel = false;
    if (which === 'brake') input.brake = false;
    activeTouches.delete(e.pointerId);
  }
}
canvas.addEventListener('pointerdown', (e) => onPointer(e, true));
canvas.addEventListener('pointerup', (e) => onPointer(e, false));
canvas.addEventListener('pointercancel', (e) => onPointer(e, false));

// ---- 固定步長更新 ----
function stepTick() {
  const w = world;
  if (w.phase === 'VERDICT' || w.phase === 'SAFE') return;

  if (w.phase === 'FROZEN') {
    w.freezeTicks -= 1;
    if (w.freezeTicks <= 0) {
      w.fsm.dispatch('SHOW_VERDICT');
      w.phase = 'VERDICT';
    }
    return;
  }

  w.tick += 1;

  // 車輛物理（真核心）
  w.car = updateVehiclePhysics(w.car, input.accel, input.brake, VEHICLE, 1, DT);

  // 路人 AI：車靠近 25m 內開始橫越
  if (!w.pedJumping && w.car.positionMeter.x > w.pedX - 25) w.pedJumping = true;
  if (w.pedJumping && w.pedY > -1.5) {
    const prevY = w.pedY;
    w.pedY -= 2.2 * DT; // 橫向踏入車道
    if (prevY > PED_ENTRY_Y && w.pedY <= PED_ENTRY_Y) w.pedEntryTick = w.tick; // 記錄進入車道 tick
  }

  // 碰撞檢測（真核心 AABB）
  const cb = carBox(w.car.positionMeter.x, w.car.positionMeter.y);
  const pb = pedBox(w.pedX, w.pedY);
  if (w.pedEntryTick !== null && checkAABBCollision(cb, pb)) {
    w.collisionTick = w.tick;
    const timeDiffTicks = w.collisionTick - w.pedEntryTick;
    w.verdict = calculateCollision({
      impactSpeedMps: w.car.velocityMps.x,
      vehicleWeightClass: 1.0,
      impactZone: 'FRONT',
      timeDiffTicks,
      driverArgLevel: 1,
      pedestrianArgLevel: 1,
      driverBrakeLevel: 1,
      pedestrianDodgeLevel: 1
    });
    w.fsm.dispatch('COLLISION_OCCURRED');
    w.freezeTicks = 3; // §物理凍結 50ms
    w.phase = 'FROZEN';
    return;
  }

  // 安全通過
  if (w.car.positionMeter.x > w.pedX + 15) w.phase = 'SAFE';
}

// ---- 渲染 ----
function worldToScreen(x: number, y: number, camX: number) {
  const sx = (x - camX) * PX_PER_M + window.innerWidth * 0.35;
  const sy = window.innerHeight * 0.5 + y * PX_PER_M;
  return { sx, sy };
}

function draw() {
  const w = world;
  const W = window.innerWidth, H = window.innerHeight;
  const camX = w.car.positionMeter.x;
  ctx.clearRect(0, 0, W, H);

  // 路面
  ctx.fillStyle = '#3a3a3a';
  const roadTop = worldToScreen(0, -LANE_HALF, camX).sy;
  const roadBot = worldToScreen(0, LANE_HALF, camX).sy;
  ctx.fillRect(0, roadTop, W, roadBot - roadTop);
  // 車道中線（虛線）
  ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 3; ctx.setLineDash([20, 18]);
  ctx.beginPath(); const midY = worldToScreen(0, 0, camX).sy;
  ctx.moveTo(0, midY); ctx.lineTo(W, midY); ctx.stroke(); ctx.setLineDash([]);
  // 人行道（路人預備區）
  ctx.fillStyle = '#4b4b4b';
  ctx.fillRect(0, roadBot, W, worldToScreen(0, 5, camX).sy - roadBot);

  // 路人
  const p = worldToScreen(w.pedX, w.pedY, camX);
  ctx.font = `${PX_PER_M * 1.4}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(w.pedJumping ? '🏃' : '🧍', p.sx, p.sy);

  // 車輛
  const c = worldToScreen(w.car.positionMeter.x, w.car.positionMeter.y, camX);
  ctx.save(); ctx.translate(c.sx, c.sy);
  ctx.font = `${PX_PER_M * 2.2}px serif`;
  ctx.fillText('🚗', 0, 0);
  ctx.restore();

  // HUD
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '16px system-ui';
  ctx.fillText(`時速 ${(w.car.velocityMps.x * 3.6).toFixed(0)} km/h`, 16, 28);
  ctx.fillText(`Tick ${w.tick}`, 16, 50);
  if (w.pedEntryTick !== null) ctx.fillText(`路人入車道 @${w.pedEntryTick}t`, 16, 72);

  // 觸控按鈕
  drawButton(btnAccel, '⬆', '#2e7d32');
  drawButton(btnBrake, '🛑', '#b23b3b');

  // 判決 / 安全 彈窗
  if (w.phase === 'VERDICT' && w.verdict) drawVerdict(w.verdict, w);
  if (w.phase === 'SAFE') drawBanner('安全通過！沒撞到人 🎉', '點畫面重新開始', '#2e7d32');
}

function drawButton(b: { x: number; y: number; r: number }, label: string, color: string) {
  ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
  ctx.fillStyle = color + 'cc'; ctx.fill();
  ctx.fillStyle = '#fff'; ctx.font = `${b.r}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(label, b.x, b.y);
}

function drawBanner(title: string, sub: string, color: string) {
  const W = window.innerWidth, H = window.innerHeight;
  ctx.fillStyle = 'rgba(0,0,0,0.72)'; ctx.fillRect(0, H * 0.32, W, H * 0.36);
  ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.font = 'bold 30px system-ui';
  ctx.fillText(title, W / 2, H * 0.46);
  ctx.fillStyle = '#ddd'; ctx.font = '18px system-ui';
  ctx.fillText(sub, W / 2, H * 0.56);
}

function drawVerdict(v: CalculateCollisionOutput, w: World) {
  const timeDiff = (w.collisionTick! - w.pedEntryTick!);
  const driverFull = v.finalDriverFaultRatio >= 0.5;
  const title = v.isAmbiguousZone ? '灰色地帶：警察隨機裁決 ⚖️'
    : driverFull ? '駕駛全責，賠償路人 💸' : '路人碰瓷失敗，倒賠修車 🤑';
  const color = v.isAmbiguousZone ? '#c9a227' : driverFull ? '#b23b3b' : '#2e7d32';
  const money = driverFull ? `- $${v.payoutAmount}（駕駛付）` : `+ $${v.penaltyAmount}（路人付）`;
  const W = window.innerWidth, H = window.innerHeight;
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, H * 0.24, W, H * 0.52);
  ctx.textAlign = 'center';
  ctx.fillStyle = color; ctx.font = 'bold 26px system-ui'; ctx.fillText(title, W / 2, H * 0.34);
  ctx.fillStyle = '#fff'; ctx.font = '18px system-ui';
  ctx.fillText(`時間差 ${timeDiff} Ticks（${(timeDiff / 60).toFixed(3)} 秒）`, W / 2, H * 0.42);
  ctx.fillText(`駕駛責任 ${(v.finalDriverFaultRatio * 100).toFixed(0)}%`, W / 2, H * 0.48);
  ctx.fillText(`路人扣血 ${v.pedestrianHpLoss}｜車損 ${v.vehicleDurabilityLoss}`, W / 2, H * 0.54);
  ctx.font = 'bold 22px system-ui'; ctx.fillStyle = color; ctx.fillText(money, W / 2, H * 0.61);
  ctx.fillStyle = '#ddd'; ctx.font = '16px system-ui'; ctx.fillText('點畫面重新開始', W / 2, H * 0.68);
}

// ---- 主迴圈：accumulator 固定步長（§9.1）----
let last = performance.now();
let acc = 0;
function frame(now: number) {
  acc += (now - last) / 1000; last = now;
  let steps = 0;
  while (acc >= DT && steps < 5) { stepTick(); acc -= DT; steps += 1; }
  draw();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
