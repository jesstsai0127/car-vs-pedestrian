# 後續延伸模組規格書 (Post-MVP Extension Modules)

> 本檔收錄 MVP（1~4）完成後的延伸系統規格，與主規格 `SPEC.md` 分開維護。
> 原始提供時標為「第 19~24 章」，但 `SPEC.md` 的 §19~§23 已被用作 Open-Questions 追蹤章節，
> 為避免章節號衝突，此處改以模組名稱編排（原章節號附註於標題）。**依內容不依章節順序。**
>
> ⚠️ **實作前必讀**：本延伸宣稱「零破壞性變更」，但初步比對發現數處與已交付的 MVP1/MVP2 程式**不相容**，
> 需在動工前先對齊（見文末〈與現有實作的衝突清單〉）。目前僅歸檔，尚未實作。

---

## 模組 A：隨機事件擴充（原第 19 章）

得益於 `IRandomEvent` 動態化設計，新增事件僅需於 `src/core/events/` 實作介面並註冊至 `REGISTERED_EVENTS` 陣列，無須改 `TickEngine`。

### A.1 擴充事件定義（`src/core/events/extendedEvents.ts`）

```typescript
import { IRandomEvent, GameContext } from './RandomEventManager';

// 1. 路面油污打滑 (OIL_SPILL_EVENT)
export const OIL_SPILL_EVENT: IRandomEvent = {
  id: 'OIL_SPILL_EVENT',
  name: '路面油污打滑',
  getProbability: (ctx) => 0.02 * (ctx.currentLevelId - 1),
  canTrigger: (ctx) => ctx.currentLevelId >= 2 && ctx.vehicleSpeedKmh > 30,
  onTrigger: (ctx) => { /* 煞車減速度降 50%，轉向阻力歸零 */ }
};

// 2. 阿嬤鬼切 (ELDERLY_SCOOTER_EVENT)
export const ELDERLY_SCOOTER_EVENT: IRandomEvent = {
  id: 'ELDERLY_SCOOTER_EVENT',
  name: '阿嬤無預警鬼切',
  getProbability: (ctx) => 0.015 * ctx.currentLevelId,
  canTrigger: (ctx) => ctx.pedestrianDistanceMeter < 15,
  onTrigger: (ctx) => { /* 前方 AI 實體發動無預警橫向急轉 */ }
};

// 3. 野狗突衝 (DOG_DASH_EVENT)
export const DOG_DASH_EVENT: IRandomEvent = {
  id: 'DOG_DASH_EVENT',
  name: '野狗衝出車道',
  getProbability: (ctx) => 0.01 * ctx.currentLevelId,
  canTrigger: (ctx) => ctx.vehicleSpeedKmh > 40,
  onTrigger: (ctx) => { /* 隨機產生野狗碰撞體，撞擊造成車輛小幅偏移 */ }
};
```

---

## 模組 B：車輛商城與物理/法律影響矩陣（原第 20 章）

### B.1 公式

1. **碰撞衝擊能量（改用動能）**：
   $$E_{impact} = \tfrac{1}{2} (W_{vehicle} + W_{driver}) \left(\tfrac{V_{impact}}{3.6}\right)^2$$
2. **豪車律師團辯解修飾**：
   $$Fault_{driver\_final} = \max\left(0.0,\ Fault_{base} \times (1 - Lawyer_{bonus}) - \text{pleaBonus}\right)$$
3. **車損維修費**：
   $$Cost_{repair} = (100 - HP) \times \text{repairPricePerHp}$$

### B.2 車輛配置（`src/core/config/vehicleConfig.ts`）

```typescript
export interface VehicleConfig {
  id: string;
  name: string;
  price: number;
  weightKg: number;
  maxSpeedKmh: number;
  acceleration: number;
  brakePower: number;
  lawyerBonus: number;        // 0.0 ~ 0.3
  repairPricePerHp: number;
  spriteKey: string;
}

export const VEHICLE_DATABASE: Record<string, VehicleConfig> = {
  OLD_SEDAN:   { id: 'OLD_SEDAN', name: '二手老爺車', price: 0, weightKg: 1200, maxSpeedKmh: 80, acceleration: 2.5, brakePower: 1.0, lawyerBonus: 0.0, repairPricePerHp: 10, spriteKey: 'car_sedan' },
  SUPER_CAR:   { id: 'SUPER_CAR', name: '極速超跑', price: 50000, weightKg: 1000, maxSpeedKmh: 160, acceleration: 6.0, brakePower: 1.8, lawyerBonus: 0.25, repairPricePerHp: 100, spriteKey: 'car_sports' },
  HEAVY_TRUCK: { id: 'HEAVY_TRUCK', name: '泥頭大卡車', price: 120000, weightKg: 5000, maxSpeedKmh: 70, acceleration: 1.5, brakePower: 0.7, lawyerBonus: 0.10, repairPricePerHp: 40, spriteKey: 'car_truck' }
};
```

---

## 模組 C：全新角色與遊戲模式（原第 21 章）

### C.1 外送員模式 (Delivery Rider)

1. **肉體傷害**（機車 $W=150$ kg，雙倍傷害）：
   $$Damage_{rider} = \left\lfloor \tfrac{E_{impact}}{100} \right\rfloor \times 2.0$$
   * 若 $Damage_{rider} \ge HP_{rider}$ → 急救送醫，扣當前總資產 **50%** 醫療費。
2. **外送限時**：
   $$\text{TargetTicks} = \left(\tfrac{\text{routeDistance}}{\text{maxSpeedKmh}/3.6}\right) \times 60 \times 1.2$$
   * 超時：$\Delta t = \tfrac{\text{elapsedTicks} - \text{TargetTicks}}{60}$，$\text{FinalPayout} = \max(0, \text{BaseReward} \times (1 - \Delta t \times 0.05))$
3. **FSM 擴充**：
   ```typescript
   export type DeliveryStateType =
     | 'DELIVERY_ORDER_SELECT'
     | 'DELIVERY_IN_TRANSIT'
     | 'DELIVERY_TIMED_OUT';
   ```

### C.2 交通法官小遊戲 (Traffic Judge Minigame)

* 讀歷史車禍紀錄（`ReplayHeader`），玩家 5 秒內輸入責任比率 $Fault_{player}$，對比 `calculateCollision` 的真相 $Fault_{truth}$：
  $$\text{Score} = \max(0,\ 100 - |Fault_{player} - Fault_{truth}| \times 100)$$

---

## 模組 D：事故重播與序列化引擎（原第 22 章 `ReplayEngine`）

只記錄事故前 300 Ticks 的輸入與 Seed（不存影片）。

```typescript
// src/core/engine/ReplayEngine.ts
export interface ReplayInputFrame {
  tick: number;
  command: string | null;
  pedestrianAction: string | null;
}

export interface ReplayHeader {
  version: string;
  initialSeed: number;
  vehicleId: string;
  levelId: number;
  startTick: number;
  collisionTick: number;
  inputHistory: ReplayInputFrame[];
}

export function simulateReplayFrame(header: ReplayHeader, currentTick: number): ReplayInputFrame | undefined {
  return header.inputHistory.find(frame => frame.tick === currentTick);
}

export class ReplayBuffer {
  private readonly maxFrames = 300;
  private frames: ReplayInputFrame[] = [];
  pushFrame(frame: ReplayInputFrame): void {
    if (this.frames.length >= this.maxFrames) this.frames.shift();
    this.frames.push(frame);
  }
  exportReplayData(): string { return JSON.stringify(this.frames); }
}
```

---

## 模組 E：動態難度演算法（原第 23 章 DDS）

| 難度參數 | 公式 | 影響 |
| :--- | :--- | :--- |
| AI 煞車反應延遲 | $\max(12, 48 - \lfloor (N-1) \times 3.5 \rfloor)$ ticks | 高關 AI 煞車更快（最快 0.2s） |
| 路人跳出侵略性 | $\min(0.85, 0.15 + 0.05N)$ | 死角碰瓷機率提升 |
| 隨機事件倍率 | $1.0 + (N-1) \times 0.2$ | 事件觸發更頻繁 |

```typescript
// src/core/progression/dynamicLevelGenerator.ts
export interface DynamicLevelConfig {
  levelId: number;
  routeDistance: number;
  requiredTurnCount: number;
  aiBrakeReactionDelayTicks: number;
  pedestrianJumpProbability: number;
  eventMultiplier: number;
}

export function generateDynamicLevelConfig(levelId: number): DynamicLevelConfig {
  const safeLevel = Math.max(1, levelId);
  return {
    levelId: safeLevel,
    routeDistance: 500 + (safeLevel - 1) * 200,
    requiredTurnCount: Math.min(10, 2 + Math.floor((safeLevel - 1) / 2)),
    aiBrakeReactionDelayTicks: Math.max(12, 48 - Math.floor((safeLevel - 1) * 3.5)),
    pedestrianJumpProbability: Math.min(0.85, 0.15 + (safeLevel - 1) * 0.05),
    eventMultiplier: 1.0 + (safeLevel - 1) * 0.2
  };
}
```

---

## 模組 F：社群與局外 Meta 系統（原第 24 章）

### F.1 重播分享連結

```typescript
// src/core/engine/replayExporter.ts
export interface ReplayExportData {
  replayHeader: ReplayHeader;
  shareableUrl: string;
}

export function generateShareableReplayLink(header: ReplayHeader): string {
  const encodedData = encodeURIComponent(btoa(JSON.stringify(header)));
  return `https://game.example.com/replay?data=${encodedData}`;
}
```

### F.2 排行榜資料結構

```typescript
// src/core/progression/leaderboard.ts
export interface LeaderboardEntry {
  playerId: string;
  playerName: string;
  role: 'DRIVER' | 'PEDESTRIAN' | 'DELIVERY';
  score: number;
  timestamp: number;
  replayHeader?: ReplayHeader;
}
```

---

## 與現有實作的衝突清單（實作前必須先對齊，非「零破壞性」）

> 以下是初步比對發現、需要你日後定案的衝突。目前僅記錄，尚未動任何 MVP 程式。

1. **🔴 E_impact 公式被改寫**：模組 B.1 用動能 $\tfrac12 m v^2$（含 $W_{driver}$、速度平方），但 MVP1 已交付並 100% 測試的 `calculateCollision`（`SPEC.md` §3.1）用的是 $E = V \times W_{vehicle} \times A_{zone}$。兩者不相容，改動會**打掉 MVP1 全部判決/賠償測試的期望值**。需決定：延伸模組是否真的要換公式，還是只在新車輛系統另計。

2. **🔴 `VehicleConfig` 型別衝突**：模組 B.2 用 `weightKg`(kg)、`maxSpeedKmh`、`brakePower`、`lawyerBonus`；但 `SPEC.md` §15.2 已定義的 `VehicleConfig` 用 `weightClass`(係數 1.0/1.3/1.8)、`maxSpeedMps`、`brakePowerMps2`、`maxDurability`。同名 interface 兩套欄位，須合併或改名。

3. **🟡 `A_zone`（撞擊角度係數）在新動能公式中消失**：MVP1 的 FRONT/SIDE 係數在 $\tfrac12 mv^2$ 裡沒有位置，需決定是否保留側撞減傷。

4. **🟡 `lawyerBonus` + `pleaBonus` 疊加在既有辯解修正之上**：§3.1 的 $Fault_{driver}$ 已有 `(P_arg - D_arg)*K_arg` 修正，模組 B.1 又加一層乘數壓制，兩層先後順序與 Clamp 邊界要定義清楚。

5. **🟡 `ReplayHeader.initialSeed` 重播決定論**：重播只存輸入+seed 要能 100% 還原，前提是**所有**隨機（含 AI 路人 timing、隨機事件）都走同一個 `SeededRNG` 且消耗順序固定——這對 MVP3 尚未完成的 `RandomEventManager` 生命週期（Q21.8）是硬前提。

6. **🟡 `generateShareableReplayLink` 用 `btoa`**：`btoa` 是瀏覽器 API，若此函數放 `src/core/` 會違反 §14.2 鐵律 1（core 不得依賴平台 API）。應歸 `src/adapters/` 或改用平台無關的 base64。
