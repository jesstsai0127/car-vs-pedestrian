// 可玩切片：駕駛=車內第一人稱（pseudo-3D，景色迎面捲動）；路人=天空俯視（看得到車與自己、可選左右側跳出）。
// 判決/物理走已測過的核心純函數。pseudo-3D 路面採經典捲動路段法（rumble strip 交替色產生速度感）。

import { calculateCollision, CalculateCollisionOutput } from '../core/judgement/collisionEngine';
import { checkAABBCollision, updateVehiclePhysics, PhysicsState, BoundingBox } from '../core/physics/physics';
import { GameFSM } from '../core/engine/GameFSM';

const DT = 1 / 60;
const LANE_HALF = 1.75;
const VEHICLE = { maxSpeedMps: 24, accelerationMps2: 4.5, brakePowerMps2: 7.0 };

const canvas = document.getElementById('game') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
let W = 0, H = 0;
function resize() {
  W = innerWidth; H = innerHeight;
  canvas.width = W * devicePixelRatio; canvas.height = H * devicePixelRatio;
  ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
  layout();
}
addEventListener('resize', resize);
// 手機旋轉（直式/橫式切換）時，部分行動瀏覽器的 resize 事件會延遲或 innerHeight 尚未更新，
// 加上 orientationchange 監聽並延遲重算，確保直式使用時版面正確重新計算。
addEventListener('orientationchange', () => setTimeout(resize, 100));

type Mode = 'MENU' | 'DRIVER' | 'PED';
type Phase = 'PLAYING' | 'FROZEN' | 'VERDICT' | 'SAFE' | 'MISS';

interface World {
  fsm: GameFSM; tick: number;
  car: PhysicsState;
  pedX: number; pedY: number; pedSide: 1 | -1; // +1 下方人行道, -1 上方
  pedJumping: boolean; pedEntryTick: number | null; collisionTick: number | null;
  freeze: number; phase: Phase; verdict: CalculateCollisionOutput | null;
}
let mode: Mode = 'MENU';
let world: World | null = null;

const carBox = (x: number, y: number): BoundingBox => ({ center: { x, y }, width: 4.2, height: 1.9 });
const pedBox = (x: number, y: number): BoundingBox => ({ center: { x, y }, width: 0.6, height: 0.6 });

function newWorld(m: Mode): World {
  return {
    fsm: new GameFSM('IN_GAME_RUNNING'), tick: 0,
    car: { positionMeter: { x: 0, y: 0 }, velocityMps: { x: m === 'DRIVER' ? 10 : 13, y: 0 }, accelerationMps2: { x: 0, y: 0 }, boundingBox: carBox(0, 0) },
    pedX: 70, pedY: 3.4, pedSide: 1,
    pedJumping: false, pedEntryTick: null, collisionTick: null,
    freeze: 0, phase: 'PLAYING', verdict: null
  };
}

// ---------- 輸入 ----------
const input = { accel: false, brake: false };
interface Btn { x: number; y: number; w: number; h: number; label: string; color: string; }
let buttons: Record<string, Btn> = {};
function layout() {
  buttons = {};
  if (mode === 'MENU') {
    const bw = Math.min(W * 0.82, 440), bh = 92;
    buttons.driver = { x: W / 2 - bw / 2, y: H * 0.4, w: bw, h: bh, label: '🚗 駕駛（車內視角）', color: '#2e5fb2' };
    buttons.ped = { x: W / 2 - bw / 2, y: H * 0.4 + bh + 22, w: bw, h: bh, label: '🚶 路人（俯視視角）', color: '#8a5a2b' };
  } else if (mode === 'DRIVER') {
    const pw = Math.min(W * 0.36, 220), ph = Math.min(H * 0.14, 120), y = H - ph - 24;
    buttons.brake = { x: 22, y, w: pw, h: ph, label: '🛑 煞車', color: '#b23b3b' };
    buttons.accel = { x: W - pw - 22, y, w: pw, h: ph, label: '⬆ 油門', color: '#2e7d32' };
  } else {
    const s = Math.min(W * 0.4, 200);
    buttons.side = { x: W / 2 - s - 10, y: H - 96, w: s, h: 64, label: '↕ 換邊', color: '#555' };
    buttons.jump = { x: W / 2 + 10, y: H - 96, w: s, h: 64, label: '⚡ 跳出', color: '#c0392b' };
  }
}
const inBtn = (b: Btn, x: number, y: number) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
const touch = new Map<number, string>();
function down(e: PointerEvent) {
  e.preventDefault(); const x = e.clientX, y = e.clientY;
  if (world && (world.phase === 'VERDICT' || world.phase === 'SAFE' || world.phase === 'MISS')) { world = newWorld(mode); return; }
  if (mode === 'MENU') {
    if (inBtn(buttons.driver, x, y)) { mode = 'DRIVER'; layout(); world = newWorld('DRIVER'); }
    else if (inBtn(buttons.ped, x, y)) { mode = 'PED'; layout(); world = newWorld('PED'); }
    return;
  }
  for (const k in buttons) if (inBtn(buttons[k], x, y)) {
    touch.set(e.pointerId, k);
    if (k === 'accel') input.accel = true;
    if (k === 'brake') input.brake = true;
    if (k === 'jump' && world && !world.pedJumping) world.pedJumping = true;
    if (k === 'side' && world && !world.pedJumping) { world.pedSide *= -1; world.pedY = 3.4 * world.pedSide; }
  }
}
function up(e: PointerEvent) {
  const k = touch.get(e.pointerId);
  if (k === 'accel') input.accel = false;
  if (k === 'brake') input.brake = false;
  touch.delete(e.pointerId);
}
canvas.addEventListener('pointerdown', down);
canvas.addEventListener('pointerup', up);
canvas.addEventListener('pointercancel', up);
addEventListener('keydown', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') input.accel = true;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === ' ') { input.brake = true; if (mode === 'PED' && world && !world.pedJumping) world.pedJumping = true; }
  if (e.key === 'r' && world) world = newWorld(mode);
});
addEventListener('keyup', (e) => {
  if (e.key === 'ArrowUp' || e.key === 'w') input.accel = false;
  if (e.key === 'ArrowDown' || e.key === 's' || e.key === ' ') input.brake = false;
});

// ---------- 更新 ----------
function step() {
  const w = world; if (!w || w.phase === 'VERDICT' || w.phase === 'SAFE' || w.phase === 'MISS') return;
  if (w.phase === 'FROZEN') { if (--w.freeze <= 0) { w.fsm.dispatch('SHOW_VERDICT'); w.phase = 'VERDICT'; } return; }
  w.tick++;
  if (mode === 'DRIVER') {
    w.car = updateVehiclePhysics(w.car, input.accel, input.brake, VEHICLE, 1, DT);
    if (!w.pedJumping && w.car.positionMeter.x > w.pedX - 24) w.pedJumping = true;
  } else {
    const nx = w.car.positionMeter.x + w.car.velocityMps.x * DT;
    w.car = { ...w.car, positionMeter: { x: nx, y: 0 }, boundingBox: carBox(nx, 0) };
  }
  const targetY = 0;
  if (w.pedJumping && ((w.pedSide === 1 && w.pedY > targetY - 1) || (w.pedSide === -1 && w.pedY < targetY + 1))) {
    const prev = w.pedY; w.pedY -= w.pedSide * 2.6 * DT;
    const crossed = w.pedSide === 1 ? (prev > LANE_HALF && w.pedY <= LANE_HALF) : (prev < -LANE_HALF && w.pedY >= -LANE_HALF);
    if (crossed) w.pedEntryTick = w.tick;
  }
  if (w.pedEntryTick !== null && checkAABBCollision(carBox(w.car.positionMeter.x, w.car.positionMeter.y), pedBox(w.pedX, w.pedY))) {
    w.collisionTick = w.tick;
    w.verdict = calculateCollision({
      impactSpeedMps: w.car.velocityMps.x, vehicleWeightClass: 1.0, impactZone: 'FRONT',
      timeDiffTicks: w.collisionTick - w.pedEntryTick,
      driverArgLevel: 1, pedestrianArgLevel: 1, driverBrakeLevel: 1, pedestrianDodgeLevel: 1
    });
    w.fsm.dispatch('COLLISION_OCCURRED'); w.freeze = 3; w.phase = 'FROZEN'; return;
  }
  if (w.car.positionMeter.x > w.pedX + 12) w.phase = (mode === 'PED' && !w.pedJumping) ? 'MISS' : 'SAFE';
}

// ---------- 共用繪圖 ----------
function roundRect(x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath(); ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function drawBtn(b: Btn) {
  ctx.fillStyle = b.color + 'e6'; roundRect(b.x, b.y, b.w, b.h, 14); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(b.h * 0.33, 24)}px system-ui`; ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2);
}

function drawMenu() {
  const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#1b2a4a'); g.addColorStop(1, '#0a0a0a');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  ctx.textAlign = 'center'; ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.min(W * 0.08, 42)}px system-ui`;
  ctx.fillText('車 vs 路人', W / 2, H * 0.24);
  ctx.fillStyle = '#c9a227'; ctx.font = `${Math.min(W * 0.04, 20)}px system-ui`;
  ctx.fillText('黑色幽默碰瓷模擬器', W / 2, H * 0.24 + 38);
  drawBtn(buttons.driver); drawBtn(buttons.ped);
  ctx.fillStyle = '#777'; ctx.font = '13px system-ui'; ctx.fillText('可玩切片 · 體驗「1 秒責任線」', W / 2, H * 0.92);
}

// ---------- 駕駛：車內第一人稱 pseudo-3D ----------
function project(dz: number, horizon: number) {
  // dz: 前方距離 (m)。回傳 { sy, scale }
  const camDepth = 6;               // 相機到近裁面
  const scale = camDepth / (dz + camDepth);
  const sy = horizon + scale * (H * 0.82 - horizon);
  return { scale, sy };
}
function drawDriver(w: World) {
  const horizon = H * 0.40;
  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, horizon); sky.addColorStop(0, '#3f66a0'); sky.addColorStop(1, '#bcd3ea');
  ctx.fillStyle = sky; ctx.fillRect(0, 0, W, horizon);
  ctx.fillStyle = '#2e4a2e'; ctx.fillRect(0, horizon, W, H - horizon); // 草地

  const carDist = w.car.positionMeter.x;
  const segLen = 4; // 每段 4m
  // 由遠到近畫路段（rumble strip 交替色 → 捲動速度感）
  for (let i = 30; i >= 0; i--) {
    const dzFar = i * segLen - (carDist % segLen);
    const dzNear = dzFar - segLen;
    if (dzNear < -segLen) continue;
    const pf = project(Math.max(dzFar, 0), horizon), pn = project(Math.max(dzNear, 0), horizon);
    const roadFar = pf.scale * W * 0.9, roadNear = pn.scale * W * 0.9;
    const worldSeg = Math.floor((carDist + i * segLen) / segLen);
    // 路面
    ctx.fillStyle = worldSeg % 2 ? '#3a3a3a' : '#343434';
    ctx.beginPath();
    ctx.moveTo(W / 2 - roadFar / 2, pf.sy); ctx.lineTo(W / 2 + roadFar / 2, pf.sy);
    ctx.lineTo(W / 2 + roadNear / 2, pn.sy); ctx.lineTo(W / 2 - roadNear / 2, pn.sy); ctx.closePath(); ctx.fill();
    // 路肩 rumble strip
    ctx.fillStyle = worldSeg % 2 ? '#c94b4b' : '#eee';
    for (const sgn of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + sgn * roadFar / 2, pf.sy); ctx.lineTo(W / 2 + sgn * (roadFar / 2 + roadFar * 0.06), pf.sy);
      ctx.lineTo(W / 2 + sgn * (roadNear / 2 + roadNear * 0.06), pn.sy); ctx.lineTo(W / 2 + sgn * roadNear / 2, pn.sy); ctx.closePath(); ctx.fill();
    }
    // 中線
    if (worldSeg % 2) {
      ctx.fillStyle = '#e8c14a';
      ctx.beginPath();
      ctx.moveTo(W / 2 - roadFar * 0.015, pf.sy); ctx.lineTo(W / 2 + roadFar * 0.015, pf.sy);
      ctx.lineTo(W / 2 + roadNear * 0.015, pn.sy); ctx.lineTo(W / 2 - roadNear * 0.015, pn.sy); ctx.closePath(); ctx.fill();
    }
  }
  // 路人投影
  const dz = w.pedX - carDist;
  if (dz > -2 && dz < 120) {
    const p = project(Math.max(dz, 0), horizon);
    const px = W / 2 + (-w.pedY / LANE_HALF) * (p.scale * W * 0.42);
    const size = Math.max(12, p.scale * H * 1.6);
    ctx.font = `${size}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText(w.pedJumping ? '🏃' : '🧍', px, p.sy);
  }
  drawCockpit(w);
}
function drawMirror(x: number, y: number, mw: number, mh: number, label: string, show: boolean, jumping: boolean, dz: number) {
  ctx.fillStyle = '#08080a'; roundRect(x, y, mw, mh, 8); ctx.fill();
  ctx.fillStyle = show ? '#3a2a2a' : '#1c2630'; roundRect(x + 3, y + 3, mw - 6, mh - 6, 6); ctx.fill();
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (show) {
    ctx.font = `${mh * 0.6}px serif`; ctx.fillText(jumping ? '🏃' : '🧍', x + mw / 2, y + mh / 2);
    ctx.fillStyle = '#e8c14a'; ctx.font = `bold ${Math.min(mh * 0.2, 12)}px system-ui`;
    ctx.fillText(`${Math.max(0, dz).toFixed(0)}m ⚠`, x + mw / 2, y + mh - 8);
  }
  ctx.fillStyle = '#888'; ctx.font = `${Math.min(mh * 0.18, 11)}px system-ui`; ctx.textAlign = 'left';
  ctx.fillText(label, x + 5, y + 11);
}

function drawCockpit(w: World) {
  const dashY = H * 0.80;
  ctx.fillStyle = '#0e0e10'; ctx.fillRect(0, dashY, W, H - dashY);
  ctx.fillStyle = '#141416'; ctx.beginPath(); ctx.moveTo(0, dashY); ctx.quadraticCurveTo(W / 2, dashY - H * 0.06, W, dashY); ctx.lineTo(W, dashY); ctx.closePath(); ctx.fill();
  // A 柱
  ctx.fillStyle = '#08080a';
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(W * 0.12, 0); ctx.lineTo(0, H * 0.55); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(W, 0); ctx.lineTo(W * 0.88, 0); ctx.lineTo(W, H * 0.55); ctx.closePath(); ctx.fill();
  // 三視角後照鏡：左 / 中(正後) / 右。路人在哪一側就在該鏡亮起
  const dz = w.pedX - w.car.positionMeter.x;
  const nearSide = dz > -2 && dz < 60 && !w.pedEntryTick;
  const onLeft = nearSide && w.pedY > LANE_HALF * 0.4;   // +Y = 左側人行道
  const onRight = nearSide && w.pedY < -LANE_HALF * 0.4;  // -Y = 右側人行道
  const mw = W * 0.2, mh = H * 0.09;
  drawMirror(8, 8, mw, mh, '左照鏡', onLeft, w.pedJumping, dz);
  drawMirror(W - mw - 8, 8, mw, mh, '右照鏡', onRight, w.pedJumping, dz);
  ctx.fillStyle = '#08080a'; roundRect(W / 2 - W * 0.13, 6, W * 0.26, mh * 0.7, 8); ctx.fill();
  ctx.fillStyle = '#2a3a2a'; roundRect(W / 2 - W * 0.125, 9, W * 0.25, mh * 0.7 - 6, 6); ctx.fill();
  ctx.fillStyle = '#888'; ctx.textAlign = 'center'; ctx.font = '10px system-ui'; ctx.fillText('車內後照鏡', W / 2, 15);
  // 時速
  ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.min(W * 0.08, 38)}px system-ui`; ctx.fillText(`${(w.car.velocityMps.x * 3.6).toFixed(0)}`, W / 2, H * 0.885);
  ctx.font = '12px system-ui'; ctx.fillStyle = '#888'; ctx.fillText('km/h', W / 2, H * 0.925);
  if (w.pedEntryTick !== null) { ctx.fillStyle = '#e8c14a'; ctx.font = '13px system-ui'; ctx.fillText('⚠ 路人已進入車道', W / 2, H * 0.845); }
  drawBtn(buttons.accel); drawBtn(buttons.brake);
}

// ---------- 路人：天空俯視 ----------
function drawPed(w: World) {
  ctx.fillStyle = '#233' ; ctx.fillRect(0, 0, W, H);
  const roadTop = H * 0.30, roadBot = H * 0.70, mid = (roadTop + roadBot) / 2;
  const mPerPx = 0.09, m2p = 1 / mPerPx;             // 固定相機（看一段路，車橫越）
  const camX = w.car.positionMeter.x - (W * 0.5) * mPerPx; // 車置中偏左推進 → 車在動、路人固定
  // 人行道（上下）
  ctx.fillStyle = '#4b4b4b'; ctx.fillRect(0, 0, W, roadTop); ctx.fillRect(0, roadBot, W, H - roadBot);
  // 車道
  ctx.fillStyle = '#333'; ctx.fillRect(0, roadTop, W, roadBot - roadTop);
  // 捲動中線（世界座標 → 有速度感）
  ctx.fillStyle = '#c9a227';
  for (let x = -(camX % 6); x < W * mPerPx + 6; x += 6) { const sx = (x) * m2p; ctx.fillRect(sx, mid - 2, 34, 4); }
  // 車（世界座標）
  const carSx = (w.car.positionMeter.x - camX) * m2p;
  ctx.font = `${Math.min(W * 0.1, 48)}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.save(); ctx.translate(carSx, mid); ctx.fillText('🚗', 0, 0); ctx.restore();
  // 路人（pedY: +下 / -上；映射到 roadBot..roadTop）
  const pedSy = mid + (w.pedY / 3.4) * (roadBot - mid);
  const pedSx = (w.pedX - camX) * m2p;
  ctx.fillText(w.pedJumping ? '🏃' : '🧍', pedSx, pedSy);
  // 提示
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.font = '15px system-ui';
  ctx.fillText(`車速 ${(w.car.velocityMps.x * 3.6).toFixed(0)} km/h`, 14, 26);
  ctx.fillText(w.pedJumping ? '已跳出！' : '選邊（換邊鈕）→ 抓時機跳出，撐過 1 秒讓駕駛全責', 14, 48);
  drawBtn(buttons.side); drawBtn(buttons.jump);
}

function drawEnd(w: World) {
  if (w.phase === 'SAFE') return banner('安全通過 🎉', mode === 'DRIVER' ? '成功避開碰瓷！' : '車開過去了…早點跳', '#2e7d32');
  if (w.phase === 'MISS') return banner('太晚了 🚶', '車已駛離，這次沒跳', '#888');
  const v = w.verdict!, td = w.collisionTick! - w.pedEntryTick!;
  const driver = v.finalDriverFaultRatio >= 0.5;
  const title = v.isAmbiguousZone ? '灰色地帶 ⚖️' : driver ? '駕駛全責 💸' : '路人碰瓷失敗 🤕';
  const color = v.isAmbiguousZone ? '#c9a227' : driver ? '#b23b3b' : '#2e7d32';
  ctx.fillStyle = 'rgba(0,0,0,0.84)'; ctx.fillRect(0, H * 0.22, W, H * 0.56);
  ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = `bold ${Math.min(W * 0.07, 30)}px system-ui`;
  ctx.fillText(title, W / 2, H * 0.32);
  ctx.fillStyle = '#fff'; ctx.font = '16px system-ui';
  ctx.fillText(`時間差 ${td} Ticks（${(td / 60).toFixed(3)} 秒）`, W / 2, H * 0.42);
  ctx.fillText(`駕駛責任 ${(v.finalDriverFaultRatio * 100).toFixed(0)}%`, W / 2, H * 0.48);
  ctx.fillText(`路人扣血 ${v.pedestrianHpLoss}｜車損 ${v.vehicleDurabilityLoss}`, W / 2, H * 0.54);
  ctx.font = `bold ${Math.min(W * 0.058, 24)}px system-ui`; ctx.fillStyle = color;
  ctx.fillText(driver ? `路人獲賠 +$${v.payoutAmount}` : `路人倒賠 -$${v.penaltyAmount}`, W / 2, H * 0.62);
  ctx.fillStyle = '#ccc'; ctx.font = '14px system-ui'; ctx.fillText('點畫面重來', W / 2, H * 0.72);
}
function banner(t: string, s: string, color: string) {
  ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.fillRect(0, H * 0.32, W, H * 0.36);
  ctx.textAlign = 'center'; ctx.fillStyle = color; ctx.font = `bold ${Math.min(W * 0.07, 30)}px system-ui`;
  ctx.fillText(t, W / 2, H * 0.44);
  ctx.fillStyle = '#eee'; ctx.font = '16px system-ui'; ctx.fillText(s, W / 2, H * 0.52);
  ctx.fillStyle = '#aaa'; ctx.font = '14px system-ui'; ctx.fillText('點畫面重來', W / 2, H * 0.58);
}

function render() {
  ctx.clearRect(0, 0, W, H);
  if (mode === 'MENU' || !world) return drawMenu();
  if (mode === 'DRIVER') drawDriver(world); else drawPed(world);
  if (world.phase === 'VERDICT' || world.phase === 'SAFE' || world.phase === 'MISS') drawEnd(world);
}

let last = performance.now(), acc = 0;
function frame(now: number) {
  acc += (now - last) / 1000; last = now;
  let n = 0; while (acc >= DT && n < 5) { step(); acc -= DT; n++; }
  render(); requestAnimationFrame(frame);
}
resize();
requestAnimationFrame(frame);
