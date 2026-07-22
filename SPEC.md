# 遊戲技術與需求規格書 (SRS - Software Requirements Specification)
# 第 1 章：專案概述 (Project Overview)


### 1.1 專案背景與核心理念 (Project Background & Core Concept)
* **遊戲名稱**：《車 vs 路人：黑色幽默碰瓷模擬器》(Car vs Pedestrian: Black Humor Fraud Simulator)。
* **核心主題**：一款結合灰色地帶法律判定、碰撞物理與黑色幽默的關卡制策略模擬遊戲。
* **雙角色非對稱玩法 (Asymmetric Gameplay)**：
  * **駕駛角度 (Driver Side)**：模擬防禦性駕駛，必須在複雜路況、導航指示與路人突發跳出（碰瓷）的雙重壓迫下，精準控制車速、打方向燈與按喇叭，安全抵達終點並避免高額賠償金。
  * **路人角度 (Pedestrian Side)**：模擬碰瓷業者，觀察車流速度與駕駛反應，尋找關鍵的「1.0 秒法律灰色地帶」精準跳出假摔，以獲取最大化金錢賠償。
* **設計目標**：透過嚴謹的碰撞引擎與 TDD（測試驅動開發）單元測試，建構出邏輯 100% 可預測、可重現，同時兼具黑色幽默與局外養成樂趣的 HTML5 網頁遊戲。


---


### 1.2 執行平台與技術選型 (Target Platforms & Tech Stack)
* **運行環境 (Runtime Environment)**：主流 Web 瀏覽器 (Chrome, Edge, Safari, Firefox)。
* **核心技術棧**：
  * **語言 (Language)**：TypeScript (嚴格型別模式 Strict Mode)。
  * **渲染引擎 (Rendering Engine)**：原生 HTML5 Canvas 2D Context API。嚴禁引進大型 3D 算圖引擎 (如 Three.js) 或大型 2D 框架 (如 Phaser)，以確保最小打包體積 (Bundle Size) 與極速載入。
  * **畫面解析度**：固定虛擬解析度 **$1280 \times 720$ (16:9)**，採用 Letterbox 視窗自適應縮放技術。
* **跨平台操作適配 (Cross-Platform Controls)**：
  * **PC 端**：支援鍵盤方向鍵、WASD 及空白鍵操作。
  * **行動端 (Mobile Touch)**：Canvas 畫面繪製虛擬按鈕適配（加速踏板、煞車踏板、方向燈切換、喇叭與跳出按鈕）。


---


### 1.3 資料持久化與存儲架構 (Persistence Architecture)
* **本地存儲機制**：預設採用瀏覽器原生的 `localStorage` 進行玩家進度與設定檔的持久化存儲。
* **轉接器解耦設計 (StorageAdapter Pattern)**：
  * 核心邏輯層**不直接呼叫** `localStorage` 全局物件。
  * 所有資料讀寫必須透過抽象介面 `IStorageAdapter` 進行操作。
  * **架構優勢**：在前端開發與單元測試 (TDD) 階段可直接注入 `MemoryStorageAdapter`（純記憶體模擬）；未來如需接入雲端數據庫、Firebase 或後端 REST API 時，僅需新增 `CloudStorageAdapter` 實作，完全無需修改遊戲核心商業邏輯。


---


### 1.4 資料庫與存儲隔離策略 (Data Isolation Strategy)
* **雙軌獨立存檔 (Dual Profile System)**：
  * 玩家的「駕駛 (Driver)」與「路人 (Pedestrian)」兩個角色之間的進度、金錢、資產與能力值**實行 100% 完全隔離**。
  * 駕駛模式獲得的賠償或支付的罰金，絕不影響路人模式的總資產；反之亦然。
* **資料結構獨立性**：
  * 本地存儲 JSON 物件內部拆分為 `driver` 與 `pedestrian` 兩個獨立的 Key-Value 節點。
  * 提供獨立的養成升級邏輯與通關紀錄清單（`levelRecords`）。


---


### 1.5 軟體工程與品質規範 (Engineering & Testing Principles)
* **測試驅動開發 (TDD First)**：
  * 遊戲核心邏輯層 (`src/core/`) 必須達成 100% 純函數化與無副作用 (No Side-Effects)。
  * 核心運算（碰撞判定、傷害計算、金額結算、FSM 狀態機轉移）必須具備完整單元測試，並覆蓋所有極端邊界條件 (Edge Cases)。
* **離散時間控制 (Fixed Timestep)**：
  * 時間運算棄用 `Date.now()` 或非固定間隔，統一由 `TickEngine` 以固定頻率 ($1\text{ Tick} = 16.667\text{ ms}$, $60\text{ FPS}$) 驅動，確保物理運算與機率測試完全可預測且無 Flaky Tests。






# 第 2 章：核心機制與角色設定 (Core Gameplay Mechanics)


### 2.1 駕駛模式 (Driver Mode)


#### 2.1.1 操作機制與輸入映射 (Input Controls)
駕駛玩家透過抽象指令 `InputCommand` 驅動車輛，核心邏輯不綁定特定硬體：


* **加速 (Accelerate)**：發送 `ACCELERATE_DOWN` / `ACCELERATE_UP` 指令。產生縱向向前加速度 $a_{acc}$。
* **煞車 (Brake)**：發送 `BRAKE_DOWN` / `BRAKE_UP` 指令。產生反向減速度 $a_{brake}$（基礎減速效果受玩家「煞車能力等級 `brakeLevel`」加成）。
* **方向燈控制 (Turn Signals)**：
  * 發送 `INDICATOR_LEFT` / `INDICATOR_RIGHT` / `INDICATOR_OFF` 切換狀態。
  * 儀表板 HUD 顯示對應方向燈綠色閃爍特效與「噠-噠-噠」音效。
* **喇叭按鈕 (Horn Blast)**：
  * 發送 `HORN_PRESS` / `HORN_RELEASE` 指令。
  * **主動定身效果**：對車頭前方直線距離 $< 20\text{ 公尺}$ 內的路人實施強制定身。
  * **定身持續時間計算**：
    $$\text{StunTicks} = \left(0.2 + \text{hornLevel} \times 0.05\right) \times 60\text{ Ticks}$$
    *(定身期間路人無法進行移動或發動跳出假摔動作)*


#### 2.1.2 導航系統與路口轉向規則 (Navigation System)
* **關卡導航任務**：關卡初始化時設定路程總長度 `routeDistance` 與必須進行轉彎的總次數 `requiredTurnCount`。
* **路口判定區 (Turn Trigger Zone)**：每個導航路口前設有長度為 $10\text{ 公尺}$ 的觸發區域。
* **轉向校驗邏輯**：車輛進入觸發區域並產生轉向角速度時，系統校驗當前 `indicatorState`：
  * 指示左轉但方向燈未開啟或打成右轉 $\rightarrow$ 判定為轉錯方向。
  * 指示右轉但方向燈未開啟或打成左轉 $\rightarrow$ 判定為轉錯方向。
  * 指示直行但打左/右方向燈 $\rightarrow$ 判定為轉錯方向。


#### 2.1.3 通關條件與失敗懲罰規則 (Win/Loss Rules)
* **通關成功 (Level Clear)**：
  1. 行駛距離達到 `routeDistance` 並安全抵達終點。
  2. 當前剩餘時間 $T_{remain} > 0\text{ 秒}$。
  3. 總資產金額不為負值 ($\text{money} \ge 0$)。
* **導航轉錯懲罰 (`WRONG_TURN`)**：
  * **無損重置**：轉錯方向時，立即發起關卡重置，**不扣除任何玩家金錢，亦不損耗車輛耐久度**。
  * **重試計數與降關機制**：單一關卡內連續轉錯次數 `retryCount` 達 3 次時，觸發降關懲罰，自動將玩家降退至上一關卡：
    $$\text{newLevelId} = \max(1, \text{currentLevelId} - 1)$$
* **車禍事故懲罰 (`ACCIDENT_RESULT`)**：
  * 發生碰撞時強制進入法庭結算，依據 $Fault_{driver}$ 計算賠償金額 $Payout$ 與車損 $Vehicle_{loss}$。


---


### 2.2 路人模式 (Pedestrian Mode)


#### 2.2.1 操作機制與跳出點選擇 (Input & Positioning)
路人玩家採用 2D 正上方俯瞰視角 (Top-down View)，控制邏輯如下：


* **預備跳出點選擇 (Spawn Marker Selection)**：
  * 關卡車道旁設有若干固定的預備跳出點（如：路邊停靠車輛後方、變電箱旁、斑馬線邊緣）。
  * 玩家透過點擊 UI 選定當前準備發動碰撞的預備點。
* **跳出/假摔發動 (`PEDESTRIAN_JUMP`)**：
  * 玩家點擊「跳出/假摔」按鈕後，路人實體以速度 $V_{pedestrian}$ 橫向踏入車道。
  * 系統開始紀錄路人包圍盒 (Bounding Box) 首次接觸車道邊界的精確時間點 `entryTick`。


#### 2.2.2 准入場景與通關門檻 (Access & Win Requirements)
* **場景准入門檻 (Access Money Threshold)**：
  * 進入特定關卡前，系統檢查路人總資產：
    $$\text{pedestrian.money} \ge \text{accessMoneyThreshold}$$
  * 若資產不足，無法解鎖該高級碰瓷場景（如：豪宅區、商業中心車道）。
* **關卡通關目標 (Target Money Goal)**：
  * 路人玩家在單一關卡內，必須透過碰瓷詐騙累積取得足夠金額的賠償金：
    $$\text{totalEarnedPayout} \ge \text{targetMoneyGoal}$$


#### 2.2.3 碰瓷核心策略 (Core Strategy)
* **目標**：精準預判 AI 駕駛之車速 $V_{vehicle}$ 與煞車反應延遲 `aiBrakeReactionDelay`。
* **最佳壓線時機**：創造時間差 $T_{diff} > 62\text{ Ticks}$（明顯超過 1.0 秒）的碰撞，使駕駛被判決 100% 肇事責任 ($Fault_{driver} = 1.0$)，以榨取最高額賠償 $Payout$。**（2026-07-23 勘誤：原文誤寫 $\le 1.0\text{s} \to$ 駕駛全責，與權威定案 §3.3 方向相反，已更正——時間差越大、駕駛責任越重。）**
* **假車禍失敗風險**：若跳出過早 ($T_{diff} \le 1.0\text{s}$ 但被 AI 駕駛及時煞停並未發生碰撞)，或進入車道過晚被判定為路人主動撞擊車側，可能導致碰瓷失敗，反被法庭判處支付車輛維修罰金 $Penalty$。


---


### 2.3 雙角色切換與資料隔離機制 (Role Switching & Data Isolation)


#### 2.3.1 切換 UI 流程 (Switching Flow)
玩家可以在標題大廳 (`TitleScreen`) 隨時切換遊玩身份：


text
               ┌─────────────────────────────────────────┐
               │     標題大廳畫面 (TitleScreen)          │
               └────────────────────┬────────────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
      [ 選擇駕駛模式 (Driver) ]           [ 選擇路人模式 (Pedestrian) ]
                  │                                   │
                  ▼                                   ▼
     載入 driverSaveData 節點            載入 pedestrianSaveData 節點
                  │                                   │
                  ▼                                   ▼
      進入駕駛整備大廳 (Garage)           進入路人場景選擇 (LevelMap)



#### 2.3.2 資料庫完全隔離規範 (Data Boundaries)
為了維護兩套獨立遊戲體驗，`SaveManager` 在讀寫數據時遵守以下隔離鐵律：


* **金錢庫獨立**：`driver.money` 與 `pedestrian.money` 為完全不相干的整數欄位，駕駛賠錢不扣減路人資產。
* **關卡進度獨立**：駕駛模式解鎖至 Level 5，不代表路人模式自動解鎖 Level 5。
* **能力升級隔離**：駕駛升級「辯解能力」僅於駕駛模式碰撞時作用，不影響路人模式的「索賠辯解能力」。


typescript
// 雙軌資料隔離結構範例
interface GameSaveData {
  version: string;
  driver: DriverProfile;       // 駕駛專屬資料集
  pedestrian: PedestrianProfile; // 路人專屬資料集
}

### 2.4 MVP 階段演進與風險優先度矩陣


text
[ MVP 1: 判決與物理純邏輯 ] ──► [ MVP 2: FSM 狀態機與 Persistence ]
   (最高風險 / 核心價值)             (中風險 / 資料狀態與防呆)
             │
             ▼
[ MVP 3: Tick 迴圈與隨機事件 ] ──► [ MVP 4: 單一關卡 UI 與雙視角 Canvas ]
   (中風險 / 時間與亂數可重現)           (交付階段 / 100% 可玩的 Level 1)



---


#### 2.4.1 階段 1：MVP 1 - 核心碰撞與判決引擎 (`Judgement & Collision Engine`)
* **優先度 / 風險**：🔥 **最高 (High Risk)** — 遊戲最核心的黑心賠償與 1 秒灰色地帶邏輯。
* **開發範疇 (Scope)**：
  1. `AABB` 矩形碰撞盒與時間差 $T_{diff}$ 計算。
  2. $E_{impact}$ 衝擊能量公式、血量/車損扣減公式。
  3. 1 秒責任判定機制 ($Fault_{driver}$) 與辯解能力修正。
  4. 最終賠償與罰金金額 ($Payout$) 純函數。
* **TDD 驗收 Pass 條件 (Definition of Done)**：
  * [x] 包含 10 個以上的純邏輯單元測試（涵蓋 $T_{diff} < 58$、$T_{diff} > 62$ 及 $58 \le T_{diff} \le 62$ 灰色地帶特例）。
  * [x] 邊界案例斷言完全通過：$T_{diff} = 57\text{ Ticks}$ (0% 車主責任)、$T_{diff} = 63\text{ Ticks}$ (100% 車主責任)，
    與灰色地帶 $58 \le T_{diff} \le 62$ 區間內信任 `policeRngValue`（依 §3.3 2026-07-22 定案，取代舊版 60/61 Ticks 二分描述）。
  * [x] 核心邏輯層測試覆蓋率 (Code Coverage) 達 **100%**。
  * [x] 全數函數均為純函數，無存取任何 DOM 或外部狀態。
  * **實作狀態**：已完成並經 fresh-context subagent 驗收通過（2026-07-22）。檔案：`src/core/judgement/collisionEngine.ts`、`src/tests/judgement.test.ts`（21 個測試，100% 覆蓋率）。


---


#### 2.4.2 階段 2：MVP 2 - 有限狀態機與資料持久化 (`FSM & Save System`)
* **優先度 / 風險**：⚡ **中高 (Medium-High Risk)** — 保障局外養成、50% HP 限制與 Hard Reset 資料安全性。
* **開發範疇 (Scope)**：
  1. `GameFSM` 有限狀態機與合法轉移矩陣 (Transitions)。
  2. `StorageAdapter` 與 `SaveManager`（LocalStorage 讀寫與 Mocking）。
  3. 戰前檢查機制 (PreGameCheck)：HP $< 50\%$ 修復扣款與金錢不足破產判斷。
  4. 駕駛與路人雙軌 `Profile` 隔離邏輯。
* **TDD 驗收 Pass 條件 (Definition of Done)**：
  * [x] 狀態機測試：在非法狀態發送指令（如在 `VERDICT_POPUP` 發送 `ACCELERATE`）必須拋出異常或無效化（採用拋出 `InvalidStateTransitionError`）。
  * [x] 存儲測試：模擬寫入、讀取與 `HardReset()`（`executeHardReset`），斷言資料結構 $100\%$ 符合 `GameSaveData` Schema。
  * [x] 破產條件測試：`validatePreGameAccess` 斷言金錢不足且 HP $< 50$ 時 `triggerBankrupt=true`；`GameFSM` 獨立斷言 `TRIGGER_BANKRUPT` 動作正確轉移至 `GAME_OVER_HARD_RESET`（兩者尚未串成單一端到端整合測試，串接留待 MVP4 UI/Controller 層）。
  * **實作狀態**：已完成並經 fresh-context subagent 驗收（見下方）。檔案：`src/core/engine/GameFSM.ts`、`src/core/progression/{preGameCheck,saveModel}.ts`、`src/core/storage/{StorageAdapter,saveSchema}.ts`、`src/adapters/executeHardReset.ts`，共 65 個測試（連同 MVP1）、`src/core/` 100% 覆蓋率。


---


#### 2.4.3 階段 3：MVP 3 - 離散 Tick 迴圈與可預測隨機事件 (`Tick Engine & Event Manager`)
* **優先度 / 風險**：⚖️ **中度 (Medium Risk)** — 確保遊戲時間精確，且亂數在測試環境下可 100% 重現。
* **開發範疇 (Scope)**：
  1. 固定步長 `TickEngine` ($1\text{ Tick} = 16.67\text{ms}$)。
  2. `SeededRNG` 可重現亂數產生器。
  3. `RandomEventManager` 與 MVP 初期 3 大事件（突發貓咪、煞車失靈、喇叭定身）。
  4. 導航轉彎與方向燈校驗算法 (`processTurnError`)。
* **TDD 驗收 Pass 條件 (Definition of Done)**：
  * [ ] 亂數可重現測試：注入固定 Seed，斷言隨機事件於精確的 `Tick` 數觸發。
  * [ ] 煞車失靈測試：斷言事件持續 90 Ticks 內，煞車減速度強行歸 0。
  * [ ] 導航測試：斷言轉錯 3 次正確觸發 `LEVEL_DOWNGRADE` 並退回上一關。


---


#### 2.4.4 階段 4：MVP 4 - 關卡 1 完整可玩 MVP (`Playable Level 1 Delivery`)
* **優先度 / 風險**：📦 **交付階段 (Delivery Phase)** — 結合 UI 渲染，產出第一個可流暢遊玩的版本。
* **開發範疇 (Scope)**：
  1. `InputAdapter`（鍵盤與 UI 按鈕抽象映射）。
  2. `DriverHUD` (Canvas Pseudo-3D 駕駛視角 + 儀表板 + 三面後照鏡)。
  3. `PedestrianHUD` (Canvas Top-down 2D 路人俯瞰視角)。
  4. `VerdictModal` (法庭判決彈窗) 與 `GarageScreen` (整備大廳)。
* **TDD 驗收 Pass 條件 (Definition of Done)**：
  * [ ] 整合測試 (E2E Integration Test)：完成從「標題 ➔ 選擇角色 ➔ 關卡 1 駕駛/路人 ➔ 碰撞發生 ➔ 判決彈窗 ➔ 結算」的完整主流程。
  * [ ] 畫面渲染於 $1280 \times 720$ Canvas 達到穩定 $60\text{ FPS}$。
  * [ ] 輸入適配測試：模擬鍵盤/觸控發送 `InputCommand` 能正確驅動 `InGameHUD`。
`` accelerator






# 第 3 章：法律灰色地帶與碰撞引擎 (Judgement & Collision Engine)


### 3.1 物理與賠償數值計算公式 (Collision Formulas)


遊戲中發生的所有車禍碰撞，均由純函數引擎 `CollisionEngine` 進行離散數學運算，不依賴任何外部繪圖或 DOM 狀態。公式鏈定義如下：


#### 1. 衝擊能量 ($E_{impact}$) 計算公式
衝擊能量為所有傷害、車損與基礎賠償金額的源頭：
$$E_{impact} = V_{impact} \times W_{vehicle} \times A_{zone}$$


* **$V_{impact}$（碰撞車速）**：碰撞發生瞬間車輛的即時物理速度（**嚴格規範單位為 $\text{m/s}$**，若 UI 顯示為 $\text{km/h}$，必須先除以 $3.6$ 轉換）。
* **$W_{vehicle}$（車輛重量/等級係數）**：
  * 小型房車 (Sedan) = $1.0$
  * 中型 SUV / 休旅車 = $1.3$
  * 重型卡車 / 巴士 = $1.8$
* **$A_{zone}$（撞擊部位/角度係數）**：
  * 車頭正面撞擊 (`FRONT`) = $1.0$
  * 車側擦撞 (`SIDE`) = $0.4$


#### 2. 血量與車況損耗公式
* **路人 HP 扣減 ($HP_{loss}$)**：
  $$HP_{loss} = \lfloor E_{impact} \times K_{hp} \times (1 - P_{body\_bonus}) \rfloor$$
* **車輛耐久度扣減 ($Vehicle_{loss}$)**：
  $$Vehicle_{loss} = \lfloor E_{impact} \times K_{dura} \times (1 - D_{dr\_bonus}) \rfloor$$


#### 3. 肇事責任比率 ($Fault_{driver}$) 計算
* **基礎責任判決 ($Fault_{base}$)**：
  * 當踏入車道時間差 $T_{diff} > 1.0\text{ 秒}$ (61 Ticks 以上) $\rightarrow Fault_{base} = 1.0$ （駕駛全責）。
  * 當踏入車道時間差 $T_{diff} \le 1.0\text{ 秒}$ (57 Ticks 以下) $\rightarrow Fault_{base} = 0.0$ （路人違規/假摔全責）。
  * 當落在灰色壓線區間 ($58 \le \text{timeDiffTicks} \le 62$) $\rightarrow Fault_{base} = R_{police}$（由警察法庭判決拋出 $0.0 \sim 1.0$ 亂數）。
* **雙方辯解能力最終修正**：
  $$Fault_{driver} = \text{Clamp}\left(Fault_{base} + (P_{arg} - D_{arg}) \times K_{arg}, 0.0, 1.0\right)$$
  *(其中 $\text{Clamp}(x, 0.0, 1.0)$ 保證責任比率絕對限制在 $0.0 \le Fault_{driver} \le 1.0$ 的範圍內)*


#### 4. 基礎賠償金 ($Payout_{base}$)
$$Payout_{base} = E_{impact} \times K_{payout}$$


---


### 3.2 精確數值常數與等級映射公式 (Constants & Stat Mappings)


為了確保 TDD 單元測試斷言 (Assert) 能夠計算出 100% 精確的期望值，系統採用固定的物理與法律轉換常數：


* **核心轉換常數表 (Constants Table)**：
  * $K_{hp} = 0.5$ （衝擊能量轉路人扣血係數）
  * $K_{dura} = 0.3$ （衝擊能量轉車輛扣耐久係數）
  * $K_{payout} = 10.0$ （衝擊能量轉金額係數：每一單位 $E_{impact} = \$10.0$）
  * $K_{arg} = 0.05$ （辯解影響係數：雙方每差 1 點辯解等級，改變 5% 的肇事責任）


* **等級派生與映射函數 (Level-to-Stat Mappings)**：
  * **辯解等級派生**：
    * 路人辯解數值 $P_{arg} = \text{pedestrian.stats.defenseArgLevel}$ （整數等級，1 級 = 1 分）
    * 駕駛辯解數值 $D_{arg} = \text{driver.stats.defenseArgLevel}$ （整數等級，1 級 = 1 分）
  * **減傷與防禦加成映射**：
    * **路人閃避減傷率**：
      $$P_{body\_bonus} = \min\left((\text{pedestrian.stats.dodgeLevel} - 1) \times 0.05, 0.50\right)$$
      *(即 1 級減傷 0%，每升一級增加 5%，最大上限為 50%)*
    * **駕駛煞車車損減免率**：
      $$D_{dr\_bonus} = \min\left((\text{driver.stats.brakeLevel} - 1) \times 0.05, 0.50\right)$$
      *(即 1 級減免 0%，每升一級增加 5%，最大上限為 50%)*


---


### 3.3 灰色地帶 (Ambiguous Zone) 觸發條件


* **時間差判定門檻**：
  * 遊戲採用 60 FPS ($1\text{ Tick} = 16.667\text{ ms}$) 離散模擬。
  * 精確 1.0 秒定義為 $60\text{ Ticks}$。
* **職責歸屬（2026-07-22 定案）**：`isAmbiguousZone` **不是外部輸入**，而是 `calculateCollision` 內部依據 `timeDiffTicks` 自行歸納的中間值。呼叫端不傳、也不應傳這個欄位，避免與 `timeDiffTicks` 產生矛盾狀態：
  ```typescript
  const isAmbiguousZone = (timeDiffTicks >= 58 && timeDiffTicks <= 62);
  ```
* **判決邏輯分流**：
  * **若 `isAmbiguousZone === true`**：
    * 呼叫端有傳入 `policeRngValue` → $Fault_{base} = \text{policeRngValue}$。
    * 呼叫端未傳入（`undefined`）→ 保底預設 $Fault_{base} = 0.5$（責任各半）。TDD 測試中必須明確傳入 `policeRngValue` 以確保斷言 100% 可預測，不得依賴此保底值。
  * **若 `isAmbiguousZone === false` 且 `timeDiffTicks > 62`**：
    判定為駕駛反應不及過失，$Fault_{base} = 1.0$。
  * **若 `isAmbiguousZone === false` 且 `timeDiffTicks < 58`**：
    判定為路人主動危險跳出碰瓷，$Fault_{base} = 0.0$。


---


### 3.4 取整 (Rounding) 與金額單向互斥規則


* **金額單向轉移（單向互斥，不疊加算帳）**：
  * **當 $Fault_{driver} \ge 0.5$ （駕駛承擔主要責任）**：
    * 駕駛必須支付賠償金給路人：
      $$Payout = \lfloor Payout_{base} \times Fault_{driver} \rfloor$$
    * 路人免付罰金：
      $$Penalty = 0$$
  * **當 $Fault_{driver} < 0.5$ （路人碰瓷失敗 / 路人承擔主要責任）**：
    * 駕駛免付賠償金：
      $$Payout = 0$$
    * 路人必須支付車輛修復罰金給駕駛：
      $$Penalty = \lfloor Payout_{base} \times (1.0 - Fault_{driver}) \rfloor$$


* **無條件捨去與邊界 Clamp 規範**：
  * 所有產出的金錢（$Payout, Penalty$）與血量/耐久度扣額（$HP_{loss}, Vehicle_{loss}$）**全數採用 `Math.floor()` 無條件捨去至整數**，絕不出現小數點。
  * **HP 與耐久度扣減 Clamp**：
    $$\text{RemainingHP} = \max\left(0, \min\left(100, \text{CurrentHP} - HP_{loss}\right)\right)$$
    $$\text{RemainingDurability} = \max\left(0, \min\left(100, \text{CurrentDurability} - Vehicle_{loss}\right)\right)$$


---


### 3.5 純函數介面 Signature (Pure Function Types)


typescript
// 碰撞計算輸入參數包（純資料結構，無外部副作用）
interface CalculateCollisionInput {
  impactSpeedMps: number;          // 碰撞車速 (單位: m/s)
  vehicleWeightClass: number;      // 車重係數 (Sedan=1.0, SUV=1.3, Truck=1.8)
  impactZone: 'FRONT' | 'SIDE';    // 撞擊部位 ('FRONT'=1.0, 'SIDE'=0.4)
  timeDiffTicks: number;           // 踏入車道時間差 (Ticks, 60 Ticks = 1.0 秒)
  policeRngValue?: number;         // 警察判決 RNG (0.0 ~ 1.0)。isAmbiguousZone 為 true 時建議必填；
                                   // 未傳入時函數內部保底採 0.5，但 TDD 測試不得依賴此保底值
  driverArgLevel: number;          // 駕駛辯解等級 (1, 2, 3...)
  pedestrianArgLevel: number;      // 路人辯解等級 (1, 2, 3...)
  driverBrakeLevel: number;        // 駕駛煞車等級 (用於車損減免)
  pedestrianDodgeLevel: number;    // 路人閃避等級 (用於 HP 減傷)
}


// 碰撞計算輸出結果包
interface CalculateCollisionOutput {
  impactEnergy: number;            // 原始計算之 E_impact (浮點數)
  isAmbiguousZone: boolean;        // 函數內部依 timeDiffTicks 歸納之壓線灰色區域判定 (58~62 Ticks)
  pedestrianHpLoss: number;        // 取整後路人扣減血量 (整數)
  vehicleDurabilityLoss: number;   // 取整後車輛扣減耐久度 (整數)
  finalDriverFaultRatio: number;   // Clamp 修正後駕駛責任比率 (0.0 ~ 1.0)
  payoutAmount: number;            // 駕駛需支付之賠償金額 (整數, 互斥)
  penaltyAmount: number;           // 路人需支付之罰金金額 (整數, 互斥)
}


/**
 * 核心碰撞判決純函數 (Pure Function)
 * 嚴禁在此函數內呼叫 DOM、Math.random() 或 localStorage
 */
function calculateCollision(input: CalculateCollisionInput): CalculateCollisionOutput;



---


### 3.6 碰撞數據事件日誌 (Collision Event Log Schema)


每次車禍碰撞發生後，系統自動將計算過程與結果封裝為不可變 (Immutable) 的 `CollisionRecord` 物件，存入歷史紀錄並提供 TDD 斷言比對：


typescript
interface CollisionRecord {
  recordId: string;              // 事故唯一識別碼 (UUID v4)
  timestamp: number;             // 發生瞬間的 UNIX 毫秒時間戳記
  levelId: number;               // 發生事故的關卡 ID
  playerRole: 'DRIVER' | 'PEDESTRIAN'; // 玩家當前遊玩的角色


  // 物理與撞擊參數
  impactSpeedMps: number;        // 碰撞車速 (m/s)
  vehicleWeightClass: number;    // 車輛重量係數
  impactZone: 'FRONT' | 'SIDE';  // 撞擊位置
  impactEnergy: number;          // 產生的衝擊能量 E_impact


  // 時間與判定參數
  pedestrianEntryTick: number;   // 路人踏入車道的 Tick
  collisionTick: number;          // 車輛與路人包圍盒相交的 Tick
  timeDiffTicks: number;         // 時間差 T_diff (Ticks)
  isAmbiguousZone: boolean;      // 是否進入黃燈灰色判決


  // 辯解與責任結果
  driverArgLevel: number;        // 駕駛辯解等級
  pedestrianArgLevel: number;    // 路人辯解等級
  policeRngValue?: number;       // 若為灰色區域時採用的判決亂數值
  finalDriverFaultRatio: number; // 最終駕駛責任百分比 (0.0 ~ 1.0)


  // 結算數值
  pedestrianHpLoss: number;      // 路人實際扣減血量 (整數)
  vehicleDurabilityLoss: number; // 車輛實際扣減耐久度 (整數)
  payoutAmount: number;          // 駕駛賠償金 (整數, 互斥)
  penaltyAmount: number;         // 路人罰金 (整數, 互斥)
}





# 第 4 章：遊戲狀態與機制分類 (Game Flow & State Rules)


### 4.1 三種「失敗」語意精確定義 (Failure Semantics)


為避免 FSM 狀態轉移混淆以及單元測試斷言不一致，遊戲中的「失敗」嚴格劃分為以下三種獨立且互斥的類型：


#### 1. `WRONG_TURN` (導航轉錯/未打方向燈)
* **觸發情境**：駕駛玩家在導航路口轉彎時，未按規定打左/右方向燈，或與導航指示方向不符。
* **處理機制**：
  * **零代價重置**：立即重置當前關卡，**不扣除任何金錢，亦不損耗車輛耐久度**（`payoutAmount = 0`, `vehicleHpLoss = 0`）。
  * **轉錯次數與降關判定**：當前關卡轉錯次數 `retryCount` 增加 $1$。若連續轉錯達到 3 次，系統強行調低關卡等級：
    $$\text{newLevelId} = \max(1, \text{currentLevelId} - 1)$$
    *(降關後重置 `retryCount = 0`)*


#### 2. `ACCIDENT_RESULT` (車禍發生與法庭結算)
* **觸發情境**：關卡進行中，車輛包圍盒與路人包圍盒發生相交相撞。
* **處理機制**：
  * 遊戲暫停並跳出「法庭事故責任判決書」彈窗 (`VERDICT_POPUP`)。
  * 依據第 3 章公式計算肇事責任 $Fault_{driver}$、賠償金 $Payout$ 或罰金 $Penalty$、以及路人扣血與車輛扣耐久度。
  * **資產扣算**：若結算後玩家金錢 $\ge 0$ 且血量/耐久度符合開局標準，玩家點擊「簽名確定」後返回整備大廳 (`GarageScreen`)。


#### 3. `BANKRUPT_RESET` (破產強制硬性重置)
* **觸發情境**：在車禍結算或戰前檢查階段，滿足以下任一破產死鎖條件：
  * 條件 A：結算後玩家總資產金額小於 0（$\text{money} < 0$）。
  * 條件 B：當前血量/耐久度 $< 50\%$，且玩家剩餘總資產**不足以支付將血量/耐久度強制修復至 $50\%$ 的費用**。
* **處理機制**：
  * 強制切換至 `GAME_OVER_HARD_RESET` 狀態。
  * 跳出「破產清算」黑白全螢幕彈窗，點擊「重新開始」執行 `HardReset()`，完全清除 `localStorage` 並寫入 `INITIAL_GAME_SAVE`。


---


### 4.3 GameFSM 狀態機規格 (2026-07-22 定案，回應 Q20.1 / Q20.2 / Q20.4 / Q20.5)


#### 4.3.1 `GameStateType` 權威型別宣告 (Q20.1)


typescript
// src/core/engine/GameFSM.ts

export type GameStateType =
  | 'BOOTSTRAP'               // 1. 系統初始化/載入存檔
  | 'ROLE_SELECT'             // 2. 標題大廳/角色選擇
  | 'GARAGE_PREPARATION'      // 3. 整備大廳 (修車/升級/場景選擇)
  | 'IN_GAME_RUNNING'         // 4. 關卡實時進行中 (Tick 運算)
  | 'IN_GAME_PAUSED_ACCIDENT' // 5. 發生碰撞，物理凍結 (準備跳判決)
  | 'VERDICT_POPUP'           // 6. 法庭責任判決書彈窗
  | 'LEVEL_RESULT'            // 7. 關卡通關/結算畫面
  | 'GAME_OVER_HARD_RESET';   // 8. 破產清算與硬重置


此 8 個狀態為 MVP2 官方完整清單，§16.3 `ScreenTransitionRequest.fsmState: GameStateType` 引用同一型別。


#### 4.3.2 狀態轉移矩陣與非法轉移例外處理 (Q20.2)


當於非法狀態發送指令或觸發矩陣以外的轉移時，`GameFSM` **必須拋出 `InvalidStateTransitionError` 自訂例外**（不得無效化吞掉，符合 §2.4.2 DoD「必須拋出異常或無效化」二選一的前段）。


| 當前狀態 (`FromState`) | 允許觸發之動作 (`FSMAction`) | 轉移後狀態 (`ToState`) | 說明 |
| :--- | :--- | :--- | :--- |
| **`BOOTSTRAP`** | `INIT_COMPLETE` | `ROLE_SELECT` | 初始化成功，進入角色選擇 |
| **`ROLE_SELECT`** | `SELECT_ROLE` | `GARAGE_PREPARATION` | 選擇駕駛/路人角色進入整備大廳 |
| **`GARAGE_PREPARATION`** | `START_LEVEL` | `IN_GAME_RUNNING` | 通過戰前檢查，開始關卡 |
| **`GARAGE_PREPARATION`** | `SWITCH_ROLE` | `ROLE_SELECT` | 返回角色選擇 |
| **`GARAGE_PREPARATION`** | `TRIGGER_BANKRUPT` | `GAME_OVER_HARD_RESET` | 戰前檢查失敗且破產 |
| **`IN_GAME_RUNNING`** | `COLLISION_OCCURRED` | `IN_GAME_PAUSED_ACCIDENT` | 發生車禍，凍結畫面 |
| **`IN_GAME_RUNNING`** | `LEVEL_CLEAR` | `LEVEL_RESULT` | 安全抵達終點/達標通關 |
| **`IN_GAME_PAUSED_ACCIDENT`**| `SHOW_VERDICT` | `VERDICT_POPUP` | 動態凍結結束，跳出判決書 |
| **`VERDICT_POPUP`** | `CONFIRM_VERDICT` | `GARAGE_PREPARATION` | 簽認判決，返回整備大廳 |
| **`VERDICT_POPUP`** | `TRIGGER_BANKRUPT` | `GAME_OVER_HARD_RESET` | 判決結算後資產歸零破產 |
| **`LEVEL_RESULT`** | `RETURN_TO_GARAGE` | `GARAGE_PREPARATION` | 結算完成返回整備大廳 |
| **`GAME_OVER_HARD_RESET`** | `EXECUTE_HARD_RESET` | `ROLE_SELECT` | 硬重置完成，退回標題頁 |


> 表中未列出的「當前狀態 + 動作」組合一律視為非法轉移（例如 `VERDICT_POPUP` 收到 `ACCELERATE`），對應 §2.4.2 DoD 的斷言目標。
> `WRONG_TURN` 不在此表中，見 §4.3.3（Q20.4）——它不經過這張矩陣，純粹是 `IN_GAME_RUNNING` 狀態內部的資料重置，不觸發任何 `FSMAction`。


#### 4.3.3 `WRONG_TURN` 的 FSM 定位 (Q20.4)


`WRONG_TURN` **不需要獨立的 FSM 狀態**，完全保留在 `IN_GAME_RUNNING` 內部處理，不算入 §4.3.2 的轉移矩陣：
* 轉錯方向屬於「關卡內部事件」，不改變大流程狀態。
* 偵測到 `WRONG_TURN` 時，`TickEngine` 內部呼叫 `processTurnError(retryCount, levelId)`（純函數，見 §10.4）：
  * 未滿 3 次：更新 `retryCount`，車輛位置重置回關卡起點，狀態維持 `IN_GAME_RUNNING`。
  * 滿 3 次（觸發降關）：`currentLevelId` 減 1、`retryCount` 歸零，重新載入上一關卡配置，狀態依然維持 `IN_GAME_RUNNING`。


#### 4.3.4 `SaveManager` 與 `GameFSM` 的解耦機制 (Q20.5)


採用 **觀察者模式 (Observer / Event-Driven)**，確保 `GameFSM` 維持純粹、不直接存取 I/O：


1. `GameFSM` 提供訂閱介面：`onStateChange(callback: (from: GameStateType, to: GameStateType) => void)`。
2. 局外協調器（`SaveManager` 或 `GameController`，非 `src/core/` 範疇）訂閱狀態變更事件，僅在切換至特定目標狀態時自動發起持久化：


typescript
// 外層協調邏輯 (src/adapters/ 或 App 層，非 src/core/)
fsm.onStateChange((fromState, toState) => {
  if (
    toState === 'GARAGE_PREPARATION' ||
    toState === 'VERDICT_POPUP' ||
    toState === 'LEVEL_RESULT' ||
    toState === 'GAME_OVER_HARD_RESET'
  ) {
    saveManager.saveCurrentState();
  }
});


此設計符合 §13.1 列出的三個存檔觸發時機點：`onStateChange` 訂閱本身可以放在 `src/core/engine/GameFSM.ts`（僅回呼通知，不做 I/O），但實際呼叫 `saveManager.saveCurrentState()` 的協調程式碼必須放在 `src/core/` 之外。


---


### 4.2 戰前檢查 (PreGameCheck) 門檻規範


為防止玩家在殘血（HP < 50%）狀態下開局導致入場即死亡的惡性體驗，整備大廳進關卡前必須通過純函數 `validatePreGameAccess` 驗收
（**2026-07-22 定案：函數正式命名統一為 `validatePreGameAccess`，取代先前文件中出現過的 `checkPreGameAccess` 舊稱**）。


#### 門檻邊界與檢查邏輯
* **合格門檻值**：**$\text{HP} \ge 50$ （精確包含 50）**。
* **檢查流程鏈**：


text
               [ 點擊「開始關卡」按鈕 ]
                          │
                          ▼
              [ 檢查當前 HP / 車況 ]
                          │
         ┌────────────────┴────────────────┐
         ▼                                 ▼
   當前 HP >= 50                     當前 HP < 50
         │                                 │
         ▼                                 ▼
   [ 允許進入關卡 ]               [ 計算強制修復至 50% 花費 ]
  (IN_GAME_RUNNING)               Cost = (50 - HP) * repairCost
                                           │
                         ┌─────────────────┴─────────────────┐
                         ▼                                   ▼
                   金錢 >= Cost                        金錢 < Cost
                         │                                   │
                         ▼                                   ▼
             [ 自動扣款修復至 50% ]                   [ 觸發破產重置 ]
              與允許進入關卡                 (GAME_OVER_HARD_RESET)


#### 純函數介面 Signature (2026-07-22 定案，回應 Q20.3)


typescript
// 車輛/身體維修單價配置
export interface RepairCostConfig {
  repairCostPerHp: number; // 每點 HP 維修費用 ($/HP)
}

// 驗收輸入 Payload
export interface PreGameAccessInput {
  role: 'DRIVER' | 'PEDESTRIAN';
  money: number;
  hp: number;                       // 駕駛車輛 HP 或路人體力 HP (0~100)
  repairConfig?: RepairCostConfig;  // 駕駛模式需傳入
  accessMoneyThreshold?: number;    // 路人模式關卡准入門檻金額
}

// 驗收輸出結果
export interface PreGameAccessResult {
  canPass: boolean;               // 是否允許進入關卡
  deductedMoney: number;          // 強制低空修復扣除的金額 (HP < 50 時，= (50 - hp) * repairCostPerHp)
  repairedHp: number;             // 修復後的 HP（若觸發強制修復則為 50，否則等於輸入 hp）
  remainingMoney: number;         // 扣款後的剩餘金錢
  triggerBankrupt: boolean;       // 是否因金錢不足以修至 50 HP 而觸發破產硬重置
  failedReason?: string;          // 驗收失敗說明
}

/**
 * 純函數：戰前門檻檢查與強修復邏輯（僅修復至 50 HP 低空門檻，非滿血 100）
 */
export function validatePreGameAccess(input: PreGameAccessInput): PreGameAccessResult;


> **2026-07-22 二次定案**：確認為文字誤植，`repairedHp` 觸發修復時固定為 **50**，與 §4.2 流程圖、Cost 公式一致。
> 與 §16.2.2 `GarageScreen` 的手動「全額修復」（拉滿 100，Cost = `(100-hp)*repairCostPerHp`）是完全不同的兩套機制，互不影響。




# 第 5 章：局外養成與資料重置 (Progression & Hard Reset)


### 5.1 駕駛養成機制 (Driver Progression System)


駕駛模式下的養成主要提升車輛防禦性駕駛能力與法庭訴訟優勢：


#### 1. 可升級能力屬性 (Upgradable Driver Stats)
* **煞車能力 (`brakeLevel`)**：
  * **物理效果**：提升按下煞車時的反向減速度 $a_{brake}$，採用乘數公式（**權威版本，2026-07-22 定案**）：
    $$a = -a_{brake} \times \left(1 + (\text{brakeLevel} - 1) \times 0.05\right)$$
    *(Level 1 為基準 $1.0\times$ 無加成，每升一級 $+5\%$，Level 10 時為 $1.45\times$)*
  * **車損減免**：提供車輛耐久度扣減百分比加成 $D_{dr\_bonus}$：
    $$D_{dr\_bonus} = \min\left((\text{brakeLevel} - 1) \times 0.05, 0.50\right)$$
* **喇叭威力 (`hornLevel`)**：
  * **定身效果**：提升對前方 $20\text{ m}$ 內路人的定身持續 Tick 數：
    $$\text{StunTicks} = \left(0.2 + \text{hornLevel} \times 0.05\right) \times 60\text{ Ticks}$$
* **法庭辯解能力 (`defenseArgLevel`)**：
  * **訴訟優勢**：對應計算公式中的 $D_{arg}$。升級可提高駕駛訴訟扣減責任百分比的比率（每級在責任比率上扣減 $5\%$）。


#### 2. 車輛商城與替換 (Vehicle Store)
* 駕駛可於整備大廳 (`GarageScreen`) 消耗金錢解鎖並購買新車輛。
* 車輛屬性包含重量係數 $W_{vehicle}$、最高時速 $V_{max}$、基礎加速度 $a_{acc}$ 與基礎耐久度 $MaxHP$。
* 購買後更新 `driver.unlockedVehicleIds` 陣列，並允許選擇 `selectedVehicleId` 出戰。


#### 3. 能力升級指數費用公式 (Upgrade Cost Formula)
駕駛所有能力的升級費用採用指數型曲線遞增：
$$\text{UpgradeCost}(L) = \lfloor \text{BaseCost} \times (1.40)^{L - 1} \rfloor$$


| 升級項目 (`Stat Key`) | 基礎費用 (`BaseCost`) | Level 1 $\rightarrow$ 2 | Level 2 $\rightarrow$ 3 | Level 3 $\rightarrow$ 4 | Max Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **煞車能力 (`brakeLevel`)** | $\$200$ | $\$200$ | $\$280$ | $\$392$ | Level 10 |
| **喇叭威力 (`hornLevel`)** | $\$150$ | $\$150$ | $\$210$ | $\$294$ | Level 10 |
| **辯解能力 (`defenseArgLevel`)** | $\$300$ | $\$300$ | $\$420$ | $\$588$ | Level 10 |


---


### 5.2 路人養成機制 (Pedestrian Progression System)


路人模式下的養成著重於提升假摔爆發力、身體抗撞擊能力與法庭索賠優勢：


#### 1. 可升級能力屬性 (Upgradable Pedestrian Stats)
* **移動速度 (`speedLevel`)**：
  * **物理效果**：提升點擊「跳出/假摔」後路人橫向踏入車道的移動速度 $V_{pedestrian}$（基礎速度 $1.5\text{ m/s}$，每級增加 $0.2\text{ m/s}$）。
* **假摔閃避與減傷 (`dodgeLevel`)**：
  * **身體減傷**：提供路人受撞擊時的血量扣減百分比加成 $P_{body\_bonus}$：
    $$P_{body\_bonus} = \min\left((\text{dodgeLevel} - 1) \times 0.05, 0.50\right)$$
* **辯解索賠能力 (`defenseArgLevel`)**：
  * **訴訟優勢**：對應計算公式中的 $P_{arg}$。升級可提高路人索賠時增加駕駛責任百分比的比率（每級在責任比率上增加 $5\%$）。


#### 2. 能力升級指數費用公式
$$\text{UpgradeCost}(L) = \lfloor \text{BaseCost} \times (1.40)^{L - 1} \rfloor$$


| 升級項目 (`Stat Key`) | 基礎費用 (`BaseCost`) | Level 1 $\rightarrow$ 2 | Level 2 $\rightarrow$ 3 | Level 3 $\rightarrow$ 4 | Max Level |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **移動速度 (`speedLevel`)** | $\$150$ | $\$150$ | $\$210$ | $\$294$ | Level 10 |
| **假摔閃避 (`dodgeLevel`)** | $\$250$ | $\$250$ | $\$350$ | $\$490$ | Level 10 |
| **辯解能力 (`defenseArgLevel`)** | $\$300$ | $\$300$ | $\$420$ | $\$588$ | Level 10 |


---


### 5.3 硬性重置機制 (Hard Reset Mechanism)


硬性重置旨在防範玩家因資金歸零且無法過關導致的死鎖狀態，亦提供隨時重新開始遊戲的選項：


#### 1. 觸發管道
1. **主動觸發**：玩家於標題大廳 (`TitleScreen`) 手動點擊「危險：重置所有進度 (Hard Reset)」按鈕並通過二次確認。
2. **被動觸發 (`BANKRUPT_RESET`)**：在車禍結算或戰前檢查階段，玩家金錢為負且不足以將血量/車況強制修復至 $50\%$ 時，系統於 `GAME_OVER_HARD_RESET` 狀態點擊「重新開始」自動執行。


#### 2. 執行步驟鏈 (Execution Flow)
1. 調用 `IStorageAdapter.clear()` 或直接將 `localStorage.removeItem('GAME_SAVE')` 刪除。
2. 記憶體狀態全數重新載入 `INITIAL_GAME_SAVE` 初始常數。
3. 觸發 `FEEDBACK_EVENT` 音效與畫面全螢幕閃爍動畫。
4. 有限狀態機 (FSM) 強制切換回 `ROLE_SELECT` 狀態。


#### 3. 純函數與 I/O 拆分 (2026-07-22 定案，回應 Q20.6)


上述步驟 1 呼叫 `IStorageAdapter.clear()` 屬於 side effect，違反 §14.2 鐵律 1（`src/core/` 嚴禁副作用），因此拆分為兩層：


typescript
// src/core/progression/saveModel.ts — 純邏輯層，可 100% 單元測試
/**
 * 純函數：計算硬重置後的存檔狀態，不進行任何 LocalStorage 操作
 */
export function computeHardResetState(): GameSaveData {
  return { ...INITIAL_GAME_SAVE };
}



typescript
// 系統預設初始存檔常數 (Default Initial Game Save)
const INITIAL_GAME_SAVE: GameSaveData = {
  version: '1.0.0',
  driver: {
    currentLevel: 1,
    money: 1000,
    vehicleHp: 100,
    selectedVehicleId: 'default_sedan',
    unlockedVehicleIds: ['default_sedan'],
    stats: {
      brakeLevel: 1,
      hornLevel: 1,
      defenseArgLevel: 1
    },
    levelRecords: {}
  },
  pedestrian: {
    currentLevel: 1,
    money: 0,
    hp: 100,
    stats: {
      speedLevel: 1,
      dodgeLevel: 1,
      defenseArgLevel: 1
    },
    levelRecords: {}
  }
};


// src/adapters/WebStorageAdapter.ts — 協調層，允許呼叫 I/O，不算入 src/core/ 覆蓋率要求
/**
 * 協調函數：實際執行破產/主動重置的 I/O 動作
 */
export function executeHardReset(adapter: IStorageAdapter, storageKey: string): GameSaveData {
  adapter.clear();
  const resetState = computeHardResetState();
  adapter.setItem(storageKey, JSON.stringify(resetState));
  return resetState;
}



---


### 5.4 養成計算純函數介面 (Progression Pure Functions)


所有與升級費用計算、可否負擔判斷及數據扣算相關的邏輯，全數封裝為純函數供 TDD 進行單元測試：


typescript
// 升級項目類型
type DriverStatKey = 'brakeLevel' | 'hornLevel' | 'defenseArgLevel';
type PedestrianStatKey = 'speedLevel' | 'dodgeLevel' | 'defenseArgLevel';


interface UpgradeRequest {
  currentLevel: number;
  baseCost: number;
  playerMoney: number;
}


interface UpgradeResult {
  canUpgrade: boolean;
  nextLevel: number;
  costPaid: number;
  remainingMoney: number;
}


/**
 * 計算單次升級所需的精確費用 (純函數)
 */
function calculateUpgradeCost(currentLevel: number, baseCost: number): number {
  return Math.floor(baseCost * Math.pow(1.40, currentLevel - 1));
}


/**
 * 執行能力升級扣款與升級邏輯 (純函數)
 */
function processStatUpgrade(request: UpgradeRequest): UpgradeResult {
  const cost = calculateUpgradeCost(request.currentLevel, request.baseCost);
  
  if (request.playerMoney < cost || request.currentLevel >= 10) {
    return {
      canUpgrade: false,
      nextLevel: request.currentLevel,
      costPaid: 0,
      remainingMoney: request.playerMoney
    };
  }


  return {
    canUpgrade: true,
    nextLevel: request.currentLevel + 1,
    costPaid: cost,
    remainingMoney: request.playerMoney - cost
  };
}





# 第 6 章：關卡與擴充架構 (Level System & Architecture)


### 6.1 數據驅動關卡設計 (Data-Driven Level Config)


為了讓遊戲核心邏輯完全解耦，不寫死任何關卡參數，本系統採用 **數據驅動架構 (Data-Driven Architecture)**。所有關卡屬性統一由外部 JSON 設定檔或 TypeScript 靜態物件結構注入。


#### 6.1.1 關卡完整 Schema 定義 (`LevelConfig`)


typescript
// 靜態障礙物/動態事件配置
interface ObstacleConfig {
  id: string;                      // 障礙物唯一標示
  type: 'STRAY_CAT' | 'OIL_SPILL' | 'CONSTRUCTION_ZONE' | 'SPEED_BUMP';
  spawnDistanceMeter: number;      // 於賽道多少公尺處生成
  laneIndex: number;               // 所在車道 (0: 主車道, 1: 輔助車道)
  paramValue?: number;             // 附加參數 (如: 油污滑行距離、減速墊極限時速)
}


// 駕駛模式專屬參數
interface DriverLevelParams {
  timeLimitSeconds: number;        // 限時關卡倒數 (秒)
  routeDistanceMeter: number;      // 總路程長度 (公尺)
  requiredTurnCount: number;       // 導航指示轉彎總次數
  pedestrianSpawnPoints: number;   // AI 路人潛在碰瓷跳出點數量
  aiAggressionRatio: number;       // AI 路人壓線奸詐度 (0.0 ~ 1.0, 越大越接近 1.0s 壓線)
  aiBrakeFailureProbability: number; // 煞車失靈發生機率 (每秒)
}


// 路人模式專屬參數
interface PedestrianLevelParams {
  targetMoneyGoal: number;         // 關卡目標索賠總額 ($)
  accessMoneyThreshold: number;    // 准入該關卡所需的最低玩家資產 ($)
  trafficDensityPerMin: number;    // 車流量密度 (每分鐘通過車輛數)
  averageVehicleSpeedMps: number;  // NPC 車輛平均時速 (m/s)
  aiBrakeReactionDelaySec: number; // AI 駕駛看到跳出後的煞車反應延遲 (秒)
}


// 完整關卡設定檔結構
interface LevelConfig {
  levelId: number;                 // 關卡編號 (1, 2, 3...)
  levelName: string;               // 關卡名稱 (例: '1-1 安靜住宅區', '2-3 繁華商業街')
  description: string;             // 關卡背景簡介
  driverParams: DriverLevelParams;
  pedestrianParams: PedestrianLevelParams;
  obstacles: ObstacleConfig[];     // 本關包含的特殊障礙物與事件清單
}



---


### 6.2 預設難度遞增數值模型 (Default Scaling Formulas)


對於未手動撰寫特殊 JSON 配置的關卡，系統內建 **動態生成純函數 `generateLevelConfig(levelId)`**，依據關卡數 $N$ ($N \ge 1$) 進行數學遞增計算：


#### 6.2.1 駕駛模式難度遞增模型 ($N$)
* **導航轉彎次數**：
  $$\text{TurnCount}(N) = 1 + \lfloor 0.8 \times (N - 1) \rfloor$$
* **AI 路人碰瓷點數量**：
  $$\text{SpawnPoints}(N) = \min\left(2 + \lfloor 1.5 \times (N - 1) \rfloor, 10\right)$$
* **AI 路人奸詐度 (壓線精度)**：
  $$\text{Aggression}(N) = \min\left(0.50 + 0.05 \times (N - 1), 0.95\right)$$
* **路線總距離 (公尺)**：
  $$\text{RouteDistance}(N) = 200 + (N - 1) \times 50$$
* **關卡限時 (秒)**：
  $$\text{TimeLimit}(N) = 30 + \lfloor \text{RouteDistance}(N) \times 0.12 \rfloor$$


#### 6.2.2 路人模式難度遞增模型 ($N$)
* **關卡通關目標金額 ($)**：
  $$\text{TargetGoal}(N) = \lfloor 500 \times (1.50)^{N - 1} \rfloor$$
* **進場資產准入門檻 ($)**：
  $$\text{AccessThreshold}(N) = \lfloor 300 \times (1.40)^{N - 1} \rfloor$$
* **AI 駕駛煞車反應延遲 (秒)**：
  $$\text{ReactionDelay}(N) = \max\left(1.0 - 0.08 \times (N - 1), 0.20\right)$$
  *(關卡越高，AI 駕駛反應越快，煞停越迅速，碰瓷難度越高)*


---


### 6.3 策略模式擴充介面與實體系統 (Strategy Pattern)


為確保遊戲未來新增任何特殊障礙物、突發路況或特殊 NPC 時，無需修改核心迴圈，系統採用 **策略模式 (Strategy Pattern)** 封裝所有可互動實體 (Game Entities)。


#### 6.3.1 實體與碰撞結果介面


typescript
// 碰撞目標標記
type CollisionTargetType = 'VEHICLE' | 'PEDESTRIAN';


// 碰撞發生的即時影響結果
interface EntityCollisionResult {
  shouldPauseGame: boolean;       // 是否中斷遊戲觸發法庭判決
  hpLoss: number;                 // 導致的路人扣血
  durabilityLoss: number;         // 導致的車損
  payoutAmount: number;           // 導致的立即金額賠償
  speedMultiplier: number;        // 速度影響乘數 (例: 0.5 減速 50%)
  triggerAudioKey?: string;       // 觸發之特效音效 ID
  overrideUiMessage?: string;     // UI 顯示之提示訊息
}


// 所有遊戲動態/靜態實體必須實作的抽象介面
interface IGameEntity {
  id: string;
  positionMeter: { x: number; y: number };
  boundingBox: { width: number; height: number };
  isActive: boolean;


  // 實體每 Tick 更新邏輯
  onTick(currentTick: number): void;


  // 發生碰撞時的策略回應
  onCollision(targetType: CollisionTargetType, speedMps: number): EntityCollisionResult;
}



#### 6.3.2 具體策略實體範例


typescript
// 1. 突發貓咪實體 (撞擊零懲罰)
class StrayCatEntity implements IGameEntity {
  id = 'stray_cat_' + Math.random();
  positionMeter = { x: 0, y: 0 };
  boundingBox = { width: 0.5, height: 0.3 };
  isActive = true;


  onTick(currentTick: number): void {
    // 橫越車道位移邏輯
    this.positionMeter.x += 0.1;
  }


  onCollision(targetType: CollisionTargetType): EntityCollisionResult {
    this.isActive = false; // 碰撞後消失
    return {
      shouldPauseGame: false,
      hpLoss: 0,
      durabilityLoss: 0,
      payoutAmount: 0,
      speedMultiplier: 1.0,
      triggerAudioKey: 'CAT_MEOW',
      overrideUiMessage: '喵！撞到貓咪，免負法律責任！'
    };
  }
}


// 2. 路面油污實體 (失控滑行)
class OilSpillEntity implements IGameEntity {
  id = 'oil_spill_' + Math.random();
  positionMeter = { x: 0, y: 0 };
  boundingBox = { width: 2.0, height: 2.0 };
  isActive = true;


  onTick(currentTick: number): void {}


  onCollision(targetType: CollisionTargetType): EntityCollisionResult {
    return {
      shouldPauseGame: false,
      hpLoss: 0,
      durabilityLoss: 0,
      payoutAmount: 0,
      speedMultiplier: 1.2, // 滑行加速打滑
      triggerAudioKey: 'TIRE_SLIP',
      overrideUiMessage: '警告！踩到路面油污，煞車暫時失靈！'
    };
  }
}



---


### 6.4 關卡管理器純函數介面 (Level Manager Pure Functions)


所有關卡配置的計算、校驗與數據生成，全數由純函數提供，可由 TDD 直接進行斷言測試：


typescript
/**
 * 依據關卡 ID 與角色模式生成完整的 LevelConfig 物件 (純函數)
 */
function generateLevelConfig(levelId: number): LevelConfig {
  const safeLevel = Math.max(1, Math.floor(levelId));
  const routeDistance = 200 + (safeLevel - 1) * 50;


  return {
    levelId: safeLevel,
    levelName: `關卡 ${safeLevel}`,
    description: `第 ${safeLevel} 區高風險路段`,
    driverParams: {
      timeLimitSeconds: 30 + Math.floor(routeDistance * 0.12),
      routeDistanceMeter: routeDistance,
      requiredTurnCount: 1 + Math.floor(0.8 * (safeLevel - 1)),
      pedestrianSpawnPoints: Math.min(2 + Math.floor(1.5 * (safeLevel - 1)), 10),
      aiAggressionRatio: Math.min(0.50 + 0.05 * (safeLevel - 1), 0.95),
      aiBrakeFailureProbability: 0.01 * (safeLevel - 1) // 對齊 §8.3.3 權威公式，Level 1 時機率恆為 0
    },
    pedestrianParams: {
      targetMoneyGoal: Math.floor(500 * Math.pow(1.50, safeLevel - 1)),
      accessMoneyThreshold: Math.floor(300 * Math.pow(1.40, safeLevel - 1)),
      trafficDensityPerMin: 10 + safeLevel * 2,
      averageVehicleSpeedMps: 10.0 + safeLevel * 1.5,
      aiBrakeReactionDelaySec: Math.max(1.0 - 0.08 * (safeLevel - 1), 0.20)
    },
    obstacles: []
  };
}


/**
 * 檢查玩家資產是否具備進入特定關卡的准入資格 (純函數)
 */
function validateLevelAccess(
  role: 'DRIVER' | 'PEDESTRIAN',
  playerMoney: number,
  config: LevelConfig
): { canAccess: boolean; requiredMoney: number } {
  if (role === 'DRIVER') {
    // 駕駛模式無資產門檻 (但有戰前修復檢查)
    return { canAccess: true, requiredMoney: 0 };
  }


  const required = config.pedestrianParams.accessMoneyThreshold;
  return {
    canAccess: playerMoney >= required,
    requiredMoney: required
  };
}



# 第 7 章：音效與視覺回饋規格 (Audio & Visual Feedback Specifications)


### 7.1 事件驅動架構 (Event-Driven Feedback Architecture)


為了讓遊戲核心純邏輯層 (`src/core/`) 保持 $100\%$ 無副作用 (No Side-Effects) 且不依賴瀏覽器 DOM / WebAudio / Canvas API，所有影音視覺回饋全數採用 **觀察者模式 (Observer Pattern)** 與 **事件驅動適配器 (Event-Driven Adapter)** 進行解耦。


當核心邏輯發生特定事件（如：碰撞發生、打方向燈、法院判決蓋章）時，核心僅發送抽象的 `FeedbackEventPayload` 給轉接器 `IFeedbackAdapter`，不關心具體播放了什麼音效或繪製了什麼特效粒子。


#### 7.1.1 TypeScript 事件與介面定義


typescript
// 影音回饋事件類型列舉
type FeedbackEventType = 
  | 'VEHICLE_ACCELERATE' // 駕駛踩下加速
  | 'VEHICLE_BRAKE'      // 駕駛踩下煞車 (急煞)
  | 'HORN_BLAST'         // 長按喇叭
  | 'INDICATOR_TOGGLE'   // 切換/開啟方向燈
  | 'COLLISION_IMPACT'   // 車禍碰撞瞬間
  | 'VERDICT_GUILTY'     // 法庭判決：駕駛負擔主要賠償
  | 'VERDICT_INNOCENT'   // 法庭判決：假車禍/路人全責 (獲賠或付罰金)
  | 'MONEY_GAINED'       // 獲得金錢動畫
  | 'MONEY_LOST'         // 扣除金錢動畫
  | 'LEVEL_CLEAR'        // 關卡通關成功
  | 'GAME_OVER';         // 破產硬重置


// 影音回饋事件數據包
interface FeedbackEventPayload {
  type: FeedbackEventType;
  intensity?: number;                  // 強度係數 (0.0 ~ 1.0，如震動幅度、音量)
  positionMeter?: { x: number; y: number }; // 事件發生的世界座標 (公尺)
  data?: Record<string, unknown>;      // 額外附帶數據 (如金額金額 -$500)
}


// 影音回饋轉接器抽象介面
interface IFeedbackAdapter {
  trigger(event: FeedbackEventPayload): void;
}



---


### 7.2 事件對照與反饋矩陣 (Feedback Event Mapping Matrix)


下表定義各個遊戲事件觸發時，視圖層 (UI/Canvas) 與音效模組對應產生的視覺 (VFX) 與聽覺 (SFX) 反饋規格：


| 事件類型 (`FeedbackEventType`) | 觸發時機 | 視覺回饋 (Visual VFX) | 音效回饋 (Audio SFX) | 優先級 |
| :--- | :--- | :--- | :--- | :--- |
| **`COLLISION_IMPACT`** | 車輛與路人包圍盒發生成碰撞時 | 1. 畫面劇烈震動 (Screen Shake $300\text{ms}$)<br>2. 螢幕全紅閃爍 ($100\text{ms}$)<br>3. 物理凍結時間 ($Hitstop\ 50\text{ms}$) | 強烈金屬撞擊聲 + 玻璃碎裂聲 (`sfx_impact_metal`) | 🔥 最高 |
| **`HORN_BLAST`** | 駕駛玩家長按喇叭按鈕 | 車頭前方擴散黃色聲波警報特效 (`!`)，路人頭頂出現定身暈眩符號 | 汽車喇叭高亢逼近聲 (`sfx_horn_blast`) | 高 |
| **`INDICATOR_TOGGLE`** | 切換左/右方向燈 | 儀表板 (`Dashboard`) 對應方向燈箭頭呈 $2\text{ Hz}$ 綠光閃爍 | 經典機械繼電器「噠-噠-噠」聲 (`sfx_indicator_click`) | 中 |
| **`VERDICT_GUILTY`** | 判決駕駛需支付賠償金額時 | 法院判決書彈窗重砸，彈窗中央蓋上「GUILTY / 全責賠償」紅色大章 | 法官木錘沉重敲擊聲「叩！」 (`sfx_gavel_strike`) | 高 |
| **`VERDICT_INNOCENT`** | 判決路人全責或駕駛免責時 | 判決書彈窗蓋上「DISMISSED / 駁回假車禍」綠色印章，彈出綠字 `+$XXXX` | 清脆金幣灑落動畫聲 (`sfx_coins_drop`) | 高 |
| **`VEHICLE_BRAKE`** | 駕駛踩下煞車使車輛急速減速 | 車頭向下俯衝前傾微幅動畫，車胎下繪製黑色煞車痕與白煙粒子 | 輪胎高分貝摩擦地面刺耳聲 (`sfx_tire_screech`) | 中 |
| **`VEHICLE_ACCELERATE`** | 駕駛踩下加速踏板 | 車尾噴出少量灰色排氣煙霧粒子 | 引擎轉數爬升低鳴聲 (`sfx_engine_rev`) | 低 |
| **`MONEY_GAINED` / `MONEY_LOST`** | 資產增加或減少時 | HUD 頂部金錢文字縮放放大，跳出 `+$XXX` 綠字或 `-$XXX` 紅字飛出粒子 | 算盤/收銀機「叮！」一聲 (`sfx_cash_register`) | 低 |
| **`GAME_OVER`** | 進入破產強制清算狀態時 | 畫面全彩轉為黑白灰階濾鏡，中央印上「BANKRUPT / 破產重置」大紅章 | 諷刺/悲傷喇叭音效 (`sfx_bankrupt_jingle`) | 🔥 最高 |


---


### 7.3 TDD Headless Mock 測試適配器 (Headless Mocking for TDD)


在進行 TDD 單元測試時，測試環境 (Node.js / Vitest / Jest) 無法使用瀏覽器 AudioContext 或 HTML5 Canvas。


為了讓所有回饋邏輯能夠被 $100\%$ 單元測試覆蓋且不報錯，系統實作 Headless 專用的 `NullFeedbackAdapter`（或稱 `MockFeedbackAdapter`）：


typescript
/**
 * 專供單元測試 (TDD) 注入的影音轉接器 Mock 類別
 * 完全無副作用，僅紀錄被呼叫的事件紀錄供 expect() 斷言
 */
class MockFeedbackAdapter implements IFeedbackAdapter {
  public eventLogs: FeedbackEventPayload[] = [];


  /**
   * 觸發事件並紀錄至記憶體陣列
   */
  public trigger(event: FeedbackEventPayload): void {
    // 複製事件物件以防外部變更
    this.eventLogs.push(JSON.parse(JSON.stringify(event)));
  }


  /**
   * 取得最新一次被觸發的事件
   */
  public getLastEvent(): FeedbackEventPayload | undefined {
    return this.eventLogs[this.eventLogs.length - 1];
  }


  /**
   * 檢查特定類型的事件是否曾被觸發
   */
  public hasTriggered(eventType: FeedbackEventType): boolean {
    return this.eventLogs.some(e => e.type === eventType);
  }


  /**
   * 清空事件日誌
   */
  public clear(): void {
    this.eventLogs = [];
  }
}



---


### 7.4 震動與粒子純數據結構 (Shake & Particle Data Models)


為了確保 Canvas 視覺渲染能夠以數值驅動且可預測，視覺震動與粒子計算全數抽象化為純數據物件：


typescript
// 畫面震動純數據狀態
interface ScreenShakeState {
  intensity: number;      // 震動幅度 (像素)
  durationTicks: number;  // 剩餘震動 Tick 數
  decay: number;          // 每一 Tick 的衰減係數 (例如: 0.9)
}


// 純函數：計算當前 Tick 的畫面偏移位移 (x, y)
function calculateScreenShakeOffset(
  state: ScreenShakeState, 
  rngValue: number
): { offsetX: number; offsetY: number; nextState: ScreenShakeState } {
  if (state.durationTicks <= 0 || state.intensity <= 0) {
    return {
      offsetX: 0,
      offsetY: 0,
      nextState: { intensity: 0, durationTicks: 0, decay: state.decay }
    };
  }


  // 依據 RNG 計算偏移量
  const angle = rngValue * Math.PI * 2;
  const offsetX = Math.cos(angle) * state.intensity;
  const offsetY = Math.sin(angle) * state.intensity;


  return {
    offsetX,
    offsetY,
    nextState: {
      intensity: state.intensity * state.decay,
      durationTicks: state.durationTicks - 1,
      decay: state.decay
    }
  };
}



# 第 8 章：隨機事件與 PRNG 規格 (Random Event System)


### 8.1 可重現偽隨機數產生器 (Seeded PRNG - Mulberry32)


為了確保 TDD 單元測試在不同作業系統、CI/CD 自動化環境及無頭測試 (Headless Testing) 下皆能 **100% 可預測且重現**，遊戲核心邏輯層 (`src/core/`) **嚴禁直接使用原生 `Math.random()`**。


所有隨機事件、警察法庭機率判決及路人 AI 的壓線時機，全數統一透過傳入固定的種子值 (Seed) 呼叫 **Mulberry32 偽隨機數產生器**。


#### 8.1.1 `SeededRNG` TypeScript 實作規格


typescript
/**
 * 32-bit Mulberry32 偽隨機數產生器類別
 * 具備極佳的均勻分布特性與極輕量的運算成本
 */
class SeededRNG {
  private state: number;


  /**
   * @param seed 整數種子值 (例如: 12345, 99999)
   */
  constructor(seed: number) {
    this.state = seed >>> 0; // 強制轉為無符號 32 位元整數
  }


  /**
   * 取得 0.0 (含) 至 1.0 (不含) 之間的浮點數
   */
  public nextFloat(): number {
    let t = (this.state += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }


  /**
   * 取得閉區間 [min, max] 內的整數亂數
   */
  public nextInt(min: number, max: number): number {
    const minCeil = Math.ceil(min);
    const maxFloor = Math.floor(max);
    return minCeil + Math.floor(this.nextFloat() * (maxFloor - minCeil + 1));
  }


  /**
   * 依據指定機率回傳布林值
   * @param probability 機率 (0.0 ~ 1.0)
   */
  public nextBool(probability: number): boolean {
    return this.nextFloat() < probability;
  }


  /**
   * 取得當前內部狀態 (供存檔與狀態快照備份)
   */
  public getState(): number {
    return this.state;
  }
}



---


### 8.2 時間維度機率換算公式 (Probability Conversion Formulas)


隨機事件在設定檔 (`LevelConfig`) 中通常以「每秒發生機率 ($p_{sec}$)」進行數值設定。


然而，遊戲底層運算採用離散時間步長 ($1\text{ Tick} = 16.667\text{ ms}$, 即 $60\text{ FPS}$)，為了防止禎率波動導致實際觸發機率失真，必須在每個 Tick 將秒機率精確換算為「單一 Tick 觸發機率 ($p_{tick}$)`：


#### 每 Tick 機率換算公式
$$p_{tick} = \frac{p_{sec}}{60.0}$$


* **範例**：若某隨機事件每秒發生機率 $p_{sec} = 0.06$（即平均每 16.6 秒觸發一次），則在離散時間引擎中，每一 Tick 呼叫 `rng.nextBool(p_tick)` 的機率門檻值為：
  $$p_{tick} = \frac{0.06}{60.0} = 0.001$$


---


### 8.3 MVP 初期 3 大隨機事件詳細規格


在 MVP 開發階段，系統預設導入以下 3 個具備黑色幽默特色與高策略影響度的隨機事件：


#### 8.3.1 事件數據介面與 Context 規格


typescript
// 遊戲即時脈絡資料結構
interface GameContext {
  currentTick: number;              // 當前 Tick 數
  currentLevelId: number;           // 當前關卡編號
  vehicleSpeedMps: number;          // 車輛當前時速 (m/s)
  distanceToPedestrianMeter: number;// 車輛與路人當前距離 (公尺)
  isHornPressed: boolean;           // 駕駛是否正在按喇叭
  driverStats: { brakeLevel: number; hornLevel: number; defenseArgLevel: number };
  pedestrianStats: { speedLevel: number; dodgeLevel: number; defenseArgLevel: number };
  rng: SeededRNG;                   // 可重現 PRNG 實例
}


// 事件產生的數值修正效果
interface EventEffect {
  brakeMultiplier: number;          // 煞車力道乘數 (預設 1.0)
  accelerationMultiplier: number;   // 加速力道乘數 (預設 1.0)
  pedestrianFrozen: boolean;        // 路人是否被強制定身
  spawnEntities: IGameEntity[];     // 產生的動態實體 (如突發貓咪)
  triggerAudioKey?: string;         // 音效提示標籤
  overrideUiMessage?: string;       // HUD 顯示突發警告訊息
}


// 隨機事件抽象介面
interface IRandomEvent {
  id: string;
  name: string;
  baseProbabilityPerSecond: number; // 每秒基礎發生機率
  durationTicks: number;            // 事件持續 Tick 數
  
  // 純函數：檢查當前狀態是否具備觸發條件
  canTrigger(context: GameContext): boolean;
  
  // 事件啟動與持續動作 handler
  onStart(context: GameContext): EventEffect;
  onTick(context: GameContext, elapsedTicks: number): EventEffect;
  onEnd(context: GameContext): EventEffect;
}



---


#### 8.3.2 具體事件 1：突發貓咪穿越路口 (`STRAY_CAT_CROSSING`)
* **觸發條件**：車輛當前時速 $V_{vehicle} > 5.556\text{ m/s}$ ($20\text{ km/h}$)，且畫面中無其它貓咪實體。
* **觸發機率**：$p_{sec} = 0.02$ （每 Tick 機率 $p_{tick} = 0.000333$）。
* **持續時間**：$120\text{ Ticks}$ ($2.0\text{ 秒}$)。
* **事件效果**：
  * **實體生成**：在車前 $15\text{ m}$ 處生成 `StrayCatEntity` 快速橫越馬路。
  * **碰撞邏輯**：撞到貓咪不扣減路人 HP，不扣減車輛耐久度，免負任何法律金額賠償。
  * **影音反饋**：發送 `CAT_MEOW` 音效與 HUD 提示 `「喵！貓咪突發衝出，撞擊免負法律責任！」`。


#### 8.3.3 具體事件 2：車輛煞車失靈 (`BRAKE_FAILURE_EVENT`)
* **觸發條件**：關卡數 $N \ge 2$，且駕駛玩家正踩下煞車鍵 (`isBraking === true`)。
* **觸發機率**：$p_{sec} = 0.01 \times (N - 1)$（隨關卡數遞增）。
* **持續時間**：$90\text{ Ticks}$ ($1.5\text{ 秒}$)。
* **事件效果**：
  * **煞車失效**：事件持續期間強制設定 `brakeMultiplier = 0.0`，踩下煞車完全無減速效果。
  * **影音反饋**：HUD 閃爍紅色警告 `「警告！踏板油污打滑，煞車暫時失靈！」` 與刺耳金屬摩擦音效。


#### 8.3.4 具體事件 3：喇叭強制定身波 (`HORN_STUN_EFFECT`)
* **觸發條件**：駕駛玩家按下喇叭鍵，且車輛與路人距離 $< 20\text{ 公尺}$。
* **觸發機率**：條件滿足時 $100\%$ 主動觸發（非被動機率事件）。
* **持續時間**：
  $$\text{StunTicks} = \lfloor (0.20 + \text{driverStats.hornLevel} \times 0.05) \times 60 \rfloor$$
* **事件效果**：
  * **路人定身**：設定 `pedestrianFrozen = true`，持續時間內路人實體無法產生橫向與縱向位移，亦無法發動跳出假摔。


---


### 8.4 隨機事件管理器純函數與測試介面 (`RandomEventManager`)


所有事件的開關狀態、計數器與效果疊加，統一由 `RandomEventManager` 進行控管：


typescript
// 當前發生的事件動態紀錄
interface ActiveEventState {
  eventId: string;
  startTick: number;
  remainingTicks: number;
}


// 隨機事件處理結果
interface EventProcessingResult {
  activeEvents: ActiveEventState[];
  combinedEffect: EventEffect;
}


/**
 * 純函數：每 Tick 執行隨機事件檢查與效果疊加 (無外部副作用)
 */
function processRandomEvents(
  context: GameContext,
  currentActiveEvents: ActiveEventState[],
  registeredEvents: IRandomEvent[]
): EventProcessingResult {
  const nextActiveEvents: ActiveEventState[] = [];
  
  // 基礎累積效果預設值
  const combinedEffect: EventEffect = {
    brakeMultiplier: 1.0,
    accelerationMultiplier: 1.0,
    pedestrianFrozen: false,
    spawnEntities: []
  };


  // 1. 遞減並處理已在執行中的事件
  for (const active of currentActiveEvents) {
    const eventDef = registeredEvents.find(e => e.id === active.eventId);
    if (!eventDef) continue;


    const remaining = active.remainingTicks - 1;
    const elapsed = eventDef.durationTicks - remaining;
    
    // 取得當前 Tick 的效果加成
    const tickEffect = eventDef.onTick(context, elapsed);
    
    // 疊加數值修正
    combinedEffect.brakeMultiplier *= tickEffect.brakeMultiplier;
    combinedEffect.accelerationMultiplier *= tickEffect.accelerationMultiplier;
    if (tickEffect.pedestrianFrozen) combinedEffect.pedestrianFrozen = true;
    if (tickEffect.spawnEntities.length > 0) {
      combinedEffect.spawnEntities.push(...tickEffect.spawnEntities);
    }


    if (remaining > 0) {
      nextActiveEvents.push({ ...active, remainingTicks: remaining });
    } else {
      eventDef.onEnd(context);
    }
  }


  // 2. 檢查新事件的觸發 (若無同類型事件執行中)
  for (const eventDef of registeredEvents) {
    const isAlreadyActive = nextActiveEvents.some(a => a.eventId === eventDef.id);
    if (isAlreadyActive) continue;


    if (eventDef.canTrigger(context)) {
      const pTick = eventDef.baseProbabilityPerSecond / 60.0;
      if (context.rng.nextBool(pTick)) {
        // 觸發新事件
        const startEffect = eventDef.onStart(context);
        
        combinedEffect.brakeMultiplier *= startEffect.brakeMultiplier;
        combinedEffect.accelerationMultiplier *= startEffect.accelerationMultiplier;
        if (startEffect.pedestrianFrozen) combinedEffect.pedestrianFrozen = true;


        nextActiveEvents.push({
          eventId: eventDef.id,
          startTick: context.currentTick,
          remainingTicks: eventDef.durationTicks
        });
      }
    }
  }


  return {
    activeEvents: nextActiveEvents,
    combinedEffect
  };
}





# 第 9 章：離散時間與座標物理系統 (Tick Engine & 2D World Coordinates)


### 9.1 離散時間軸與固定步長驅動 (Fixed Timestep Tick Engine)


為了徹底避免瀏覽器繪圖更新率 (FPS) 波動、螢幕高更新率 ($120\text{ Hz} / 144\text{ Hz}$) 或硬體效能落差導致碰撞判定出現穿牆 (Tunneling) 與計時誤差，遊戲核心邏輯層 (**`src/core/`**) 採用 **固定步長離散時間驅動 (Fixed Timestep Engine)**。


#### 9.1.1 時間抽象與 Tick 計數
* **離散時間步長 ($\Delta t$)**：固定為 $\Delta t = \frac{1}{60}\text{ 秒} \approx 16.667\text{ ms}$（即 $1\text{ 秒} = 60\text{ Ticks}$）。
* **無狀態時間累加器 (Accumulator Pattern)**：
  * 主渲染迴圈 (`requestAnimationFrame`) 負責計算兩幀之間的實際毫秒差，並將時間注入累加器。
  * 只有當累加器時間 $\ge 16.667\text{ ms}$ 時，核心邏輯才執行一次完整的 `Tick()` 更新。
  * 限制單次幀內的最大 Tick 步長次數（上限 5 Ticks），防止效能低落時觸發死鎖螺旋 (Spiral of Death)。
* **測試重現性**：單元測試 (TDD) 可直接手動呼叫 `tickEngine.step(1)`，使遊戲精確前進 $1\text{ Tick}$，無需使用任何異步 `setTimeout` 或外部定時器。


---


### 9.2 世界座標系與物理單位規格 (2D World Coordinates & Scaling)


#### 9.2.1 物理單位標準
* **距離單位**：全數使用 **公尺 ($\text{m}$)**。
* **速度單位**：全數使用 **公尺/秒 ($\text{m/s}$)**（$1\text{ m/s} = 3.6\text{ km/h}$）。
* **加速度單位**：全數使用 **公尺/二次方秒 ($\text{m/s}^2$)**。


#### 9.2.2 二維世界座標系 (2D Cartesian Coordinates)
世界座標系採用標準笛卡兒平面，原點 $(0, 0)$ 設定於關卡起點之車道左側邊界：


* **X 軸（縱向賽道方向）**：沿車道行駛方向延伸。X 增加表示車輛向前行駛；$X = 0$ 為關卡起點，$X = \text{routeDistance}$ 為關卡終點。
* **Y 軸（橫向車道方向）**：垂直於車道的橫向位置。
  * $Y = 0\text{ m}$：車道中央中心線。
  * $Y < 0\text{ m}$：左側車道 / 人行道邊界（如：$-1.75\text{ m}$ 為左側車道邊界）。
  * $Y > 0\text{ m}$：右側車道 / 人行道邊界（如：$+1.75\text{ m}$ 為右側人行道路人跳出預備區）。


text
 (Y 橫向: 公尺)
   ▲
   │  [路人預備區 / 跳出點]  (Y = +3.0m)
───┼──────────────────────────────────────── (車道右邊界 Y = +1.75m)
   │     🚗 車輛行駛方向 ───►
   │     ────────────────────────────── (車道中心線 Y = 0.0m)
───┼──────────────────────────────────────── (車道左邊界 Y = -1.75m)
   │  [對向車道 / 人行道]    (Y = -3.0m)
───┴─────────────────────────────────────────► (X 縱向: 公尺)
 (X = 0m 起點)                       (X = RouteDistance 終點)



#### 9.2.3 渲染像素轉換率 (World-to-Pixel Conversion)
物理邏輯運算完全解耦後，視圖渲染層 (Canvas 2D) 使用固定的比例尺進行座標繪製：
$$1\text{ 公尺 (m)} = 20\text{ 像素 (px)}$$


---


### 9.3 軸對齊包圍盒碰撞檢測 (AABB Collision Detection)


為了提供高效且精確的碰撞檢測，所有動態實體（車輛、路人、貓咪、障礙物）均使用 **軸對齊包圍盒 (Axis-Aligned Bounding Box, AABB)** 表示。


#### 9.3.1 AABB 碰撞數學條件
給定實體 $A$ 與實體 $B$，其包圍盒中心座標分別為 $(x_A, y_A)$ 與 $(x_B, y_B)$，寬度與高度分別為 $(w_A, h_A)$ 與 $(w_B, h_B)$。兩者發生幾何相交的充要條件為：


$$\text{IsIntersecting} = \left( |x_A - x_B| \le \frac{w_A + w_B}{2} \right) \land \left( |y_A - y_B| \le \frac{h_A + h_B}{2} \right)$$


---


### 9.4 運動學物理更新公式 (Kinematics Equations)


在每個離散步長 $\Delta t = \frac{1}{60}\text{ 秒}$ 中，實體的位置與速度依據歐拉積分 (Euler Integration) 進行更新：


#### 1. 駕駛車輛運動學公式
* **加速度驅動**：
  * 當按住加速鍵時，當前加速度 $a = a_{acc}$。
  * 當按住煞車鍵時，當前減速度 $a = -a_{brake} \times \left(1 + (\text{brakeLevel} - 1) \times 0.05\right)$（權威公式同 §5.1，Level 1 為 $1.0\times$ 無加成）。
  * 當加速與煞車同時按住時，**煞車優先權最高**，套用同一條煞車公式 $a = -a_{brake} \times \left(1 + (\text{brakeLevel} - 1) \times 0.05\right)$。
  * 當皆未按下時，受自然滾動摩擦阻力影響，$a = -a_{friction}$ ($a_{friction} = 0.5\text{ m/s}^2$)。


* **速度與位移離散更新**：
  $$v_{next} = \text{Clamp}\left(v_{current} + a \cdot \Delta t, 0, V_{max}\right)$$
  $$x_{next} = x_{current} + v_{next} \cdot \Delta t$$


#### 2. 路人踏入車道時間差 ($T_{diff}$) 精確追蹤算法
* 當路人包圍盒 $B_{pedestrian}$ 的 Y 軸邊界首次越過車道邊界 Y 軸 ($Y = 1.75\text{ m}$) 的精確 Tick，系統紀錄為 `pedestrianEntryTick`。
* 當車輛包圍盒 $B_{vehicle}$ 與路人包圍盒 $B_{pedestrian}$ 滿足 AABB 碰撞相交的精確 Tick，系統紀錄為 `collisionTick`。
* **時間差計算**：
  $$\text{timeDiffTicks} = \text{collisionTick} - \text{pedestrianEntryTick}$$
  $$\text{timeDiffSeconds} = \frac{\text{timeDiffTicks}}{60.0}$$


---


### 9.5 物理系統純函數與 TypeScript 介面 (Physics Code Specifications)


typescript
// 2D 向量
interface Vector2D {
  x: number; // 縱向距離 (公尺)
  y: number; // 橫向距離 (公尺)
}


// 軸對齊包圍盒 (AABB)
interface BoundingBox {
  center: Vector2D; // 包圍盒中心點 (公尺)
  width: number;    // X 軸向寬度/長度 (公尺)
  height: number;   // Y 軸向高度/寬度 (公尺)
}


// 實體動態物理狀態
interface PhysicsState {
  positionMeter: Vector2D;
  velocityMps: Vector2D;
  accelerationMps2: Vector2D;
  boundingBox: BoundingBox;
}


/**
 * 純函數：檢查兩個 AABB 包圍盒是否相交 (碰撞檢測)
 */
function checkAABBCollision(a: BoundingBox, b: BoundingBox): boolean {
  const halfWidthA = a.width / 2;
  const halfWidthB = b.width / 2;
  const halfHeightA = a.height / 2;
  const halfHeightB = b.height / 2;


  const deltaX = Math.abs(a.center.x - b.center.x);
  const deltaY = Math.abs(a.center.y - b.center.y);


  return deltaX <= (halfWidthA + halfWidthB) && deltaY <= (halfHeightA + halfHeightB);
}


/**
 * 純函數：更新一 Tick 的車輛運動學狀態 (無外部副作用)
 */
function updateVehiclePhysics(
  currentState: PhysicsState,
  isAccelerating: boolean,
  isBraking: boolean,
  vehicleConfig: { maxSpeedMps: number; accelerationMps2: number; brakePowerMps2: number },
  brakeLevel: number,
  deltaSeconds: number = 1 / 60
): PhysicsState {
  let targetAcc = 0;


  // 煞車優先權最高
  if (isBraking) {
    const brakeBonus = 1 + (brakeLevel - 1) * 0.05;
    targetAcc = -vehicleConfig.brakePowerMps2 * brakeBonus;
  } else if (isAccelerating) {
    targetAcc = vehicleConfig.accelerationMps2;
  } else {
    // 滾動摩擦自然減速
    targetAcc = currentState.velocityMps.x > 0 ? -0.5 : 0;
  }


  // 更新縱向速度
  let nextVx = currentState.velocityMps.x + targetAcc * deltaSeconds;
  nextVx = Math.max(0, Math.min(vehicleConfig.maxSpeedMps, nextVx));


  // 更新縱向位置
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





# 第 10 章：導航與方向燈判定算法 (Navigation & Turn Signal Algorithm)


### 10.1 轉向路口與觸發區域 (Turn Junctions & Trigger Zones)


駕駛模式下的導航任務並非僅為視覺裝飾，而是關卡的核心考驗機制之一。導航系統透過比對駕駛玩家於路口處的車輛操作、方向燈狀態與關卡導航指示，決定是否允許通關或觸發重試。


#### 10.1.1 導航指示資料結構 (`TurnInstruction`)
在關卡初始化階段，`LevelConfig` 依據關卡 ID 生成一組按賽道縱向距離 (X 軸) 遞增排序的路口轉向指示清單：


typescript
// 方向燈指示類型
type TurnDirection = 'STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT';


// 路口轉向指示結構
interface TurnInstruction {
  junctionId: string;           // 路口唯一編號 (例: 'junc_100m')
  positionXMeter: number;       // 路口發生於賽道縱向第幾公尺 (例: 100.0m)
  requiredDirection: TurnDirection; // 導航規定的正確轉向動作
  hasChecked: boolean;          // 是否已執行過校驗判定 (防止重複觸發)
}



#### 10.1.2 轉向觸發區域 (Trigger Zone)
* **觸發區長度 ($\Delta X_{zone}$)**：每個路口 $X_{junction}$ 前方設有長度為 **$10.0\text{ 公尺}$** 的判讀區域：
  $$\text{ZoneRange} = [X_{junction} - 10.0, X_{junction}]$$
* **進入觸發區動作**：
  * 當車輛包圍盒中心點 $X_{vehicle}$ 進入該區間時，HUD 導航圖示開始高亮閃爍（如：前方 $10\text{m}$ 左轉）。
  * 當車輛跨越 $X_{junction}$ 瞬間，系統呼叫純函數 `checkTurnSignalCorrectness` 進行精確校驗。


---


### 10.2 方向燈狀態與校驗矩陣 (Indicator State & Verification Rules)


#### 10.2.1 方向燈狀態機 (Indicator State Machine)
方向燈控制器擁有三種互斥狀態：`OFF`（關閉）、`LEFT`（左轉燈）與 `RIGHT`（右轉燈）。


* **切換邏輯**：
  * 發送 `INDICATOR_LEFT` 指令：若當前為 `LEFT` 則切換為 `OFF`；否則切換為 `LEFT`。
  * 發送 `INDICATOR_RIGHT` 指令：若當前為 `RIGHT` 則切換為 `OFF`；否則切換為 `RIGHT`。
  * 發送 `INDICATOR_OFF` 指令：強制切換為 `OFF`。


#### 10.2.2 轉向校驗矩陣 (Verification Rules Matrix)


車輛跨越路口 $X_{junction}$ 時，系統比對 `requiredDirection` 與當前 `indicatorState`：


| 導航指示 (`requiredDirection`) | 當前方向燈 (`indicatorState`) | 校驗結果 (`isCorrect`) | 系統回應與處理 |
| :--- | :--- | :--- | :--- |
| **`TURN_LEFT`** (左轉) | **`LEFT`** | ✅ **Pass** | 標記 `hasChecked = true`，繼續行駛。 |
| **`TURN_LEFT`** (左轉) | **`OFF`** 或 **`RIGHT`** | ❌ **Wrong Turn** | 觸發 `WRONG_TURN` 關卡重置。 |
| **`TURN_RIGHT`** (右轉) | **`RIGHT`** | ✅ **Pass** | 標記 `hasChecked = true`，繼續行駛。 |
| **`TURN_RIGHT`** (右轉) | **`OFF`** 或 **`LEFT`** | ❌ **Wrong Turn** | 觸發 `WRONG_TURN` 關卡重置。 |
| **`STRAIGHT`** (直行) | **`OFF`** | ✅ **Pass** | 標記 `hasChecked = true`，繼續行駛。 |
| **`STRAIGHT`** (直行) | **`LEFT`** 或 **`RIGHT`** | ❌ **Wrong Turn** | 亂打方向燈，觸發 `WRONG_TURN` 重置。 |


---


### 10.3 轉錯懲罰與降關算法 (Turn Error & Downgrade Logic)


依據第 2 章與第 4 章的語意定義，導航轉錯方向屬於「駕駛違規失誤」，**絕不扣除玩家金錢，亦不損耗車輛耐久度**。


#### 10.3.1 降關遞迴演算法
* **重試計數器 (`retryCount`)**：紀錄玩家在「當前關卡」內累積轉錯的次數。
* **降關條件**：當 `retryCount + 1 >= 3`（即連續轉錯 3 次）時，觸發自動降關，退回上一關重修駕駛技術：
  $$\text{newLevelId} = \max(1, \text{currentLevelId} - 1)$$
* **計數器清零**：不論是順利通關降關，或是退回上一關，`retryCount` 全數重置為 $0$。


---


### 10.4 導航系統純函數介面 (Navigation Pure Function Specifications)


所有導航比對與降關計算全數封裝為純函數，無存取任何外部 DOM 或 SaveManager，利於 TDD 單元測試：


typescript
// 方向燈狀態
type IndicatorState = 'OFF' | 'LEFT' | 'RIGHT';


// 轉向校驗結果
interface TurnCheckResult {
  isCorrect: boolean;              // 是否正確打對方向燈
  failedReason?: string;           // 若失敗時的文字說明
}


// 導航轉錯處理結果
interface NavigationProcessResult {
  isCorrect: boolean;              // 是否正確過關
  nextRetryCount: number;          // 處理後的 retryCount
  nextLevelId: number;             // 處理後的關卡 ID
  shouldRestartLevel: boolean;     // 是否需要重置關卡起點
  isDowngraded: boolean;           // 是否觸發了降關懲罰
}


/**
 * 純函數：校驗駕駛方向燈是否符合路口指示 (無外部副作用)
 */
function checkTurnSignalCorrectness(
  requiredDirection: TurnDirection,
  currentIndicator: IndicatorState
): TurnCheckResult {
  switch (requiredDirection) {
    case 'TURN_LEFT':
      if (currentIndicator === 'LEFT') return { isCorrect: true };
      return { isCorrect: false, failedReason: '左轉路口未開啟左轉方向燈！' };


    case 'TURN_RIGHT':
      if (currentIndicator === 'RIGHT') return { isCorrect: true };
      return { isCorrect: false, failedReason: '右轉路口未開啟右轉方向燈！' };


    case 'STRAIGHT':
      if (currentIndicator === 'OFF') return { isCorrect: true };
      return { isCorrect: false, failedReason: '直行路口請勿任意亂打方向燈！' };
  }
}


/**
 * 純函數：處理轉錯方向後的重試計數與降關計算 (無外部副作用)
 */
function processTurnError(
  currentRetryCount: number,
  currentLevelId: number
): NavigationProcessResult {
  const nextRetry = currentRetryCount + 1;


  // 累積轉錯達到 3 次：觸發降關
  if (nextRetry >= 3) {
    const downgradedLevel = Math.max(1, currentLevelId - 1);
    return {
      isCorrect: false,
      nextRetryCount: 0, // 降關後重試次數清零
      nextLevelId: downgradedLevel,
      shouldRestartLevel: true,
      isDowngraded: true
    };
  }


  // 未滿 3 次：重試當前關卡
  return {
    isCorrect: false,
    nextRetryCount: nextRetry,
    nextLevelId: currentLevelId,
    shouldRestartLevel: true,
    isDowngraded: false
  };
}





# 第 11 章：輸入訊號抽象與轉譯器 (Input Adapter & Control Mapping)


### 11.1 輸入訊號抽象化架構 (Input Abstraction Architecture)


為了貫徹 **TDD 測試驅動開發** 與 **核心商業邏輯 $100\%$ 解耦** 的原則，遊戲核心邏輯層 (`src/core/`) **嚴禁直接存取任何瀏覽器原生的硬體事件**（如 `KeyboardEvent`、`TouchEvent` 或 `PointerEvent`）。


所有來自 PC 鍵盤、手機螢幕虛擬按鈕或單元測試腳本的輸入操作，全數統一透過轉譯器轉譯為高階抽象指令 `InputCommand` 與無狀態快照 `InputState`。


text
  [ PC 鍵盤 (WASD/方向鍵) ] ──┐
                              │
  [ 手機觸控虛擬按鈕 (Touch) ] ──┼──► [ IInputAdapter ] ──► [ InputCommand 串流 ] ──► [ Game Engine Core ]
                              │
  [ TDD 單元測試 Mock 指令 ] ──┘



---


### 11.2 硬體按鍵與抽象指令映射矩陣 (Control Mapping Matrix)


系統支援 **PC 鍵盤** 與 **手機觸控 UI** 雙平台對應。硬體觸發事件時，`InputAdapter` 自動發送對應的抽象指令：


| 玩家操作動作 | PC 鍵盤按鍵映射 | 手機觸控 UI 元件 | 發送之抽象指令 (`InputCommand`) | 觸發模式 |
| :--- | :--- | :--- | :--- | :--- |
| **駕駛：踩下加速** | `ArrowUp` 或 `KeyW` | 右下角「加速踏板」按下 | `ACCELERATE_DOWN` | 按住持續 (Press & Hold) |
| **駕駛：放開加速** | 釋放 `ArrowUp` / `KeyW` | 放開「加速踏板」 | `ACCELERATE_UP` | 釋放瞬間 (Release) |
| **駕駛：踩下煞車** | `ArrowDown` 或 `KeyS` / `Space` | 左下角「煞車踏板」按下 | `BRAKE_DOWN` | 按住持續 (Press & Hold) |
| **駕駛：放開煞車** | 釋放 `ArrowDown` / `KeyS` / `Space` | 放開「煞車踏板」 | `BRAKE_UP` | 釋放瞬間 (Release) |
| **駕駛：開啟/關閉左轉燈** | `ArrowLeft` 或 `KeyA` | 儀表板「左轉燈箭頭」點擊 | `INDICATOR_LEFT` | 單次觸發 (Toggle 旋鈕) |
| **駕駛：開啟/關閉右轉燈** | `ArrowRight` 或 `KeyD` | 儀表板「右轉燈箭頭」點擊 | `INDICATOR_RIGHT` | 單次觸發 (Toggle 旋鈕) |
| **駕駛：切斷方向燈** | `KeyX` | 點擊已開啟之方向燈 | `INDICATOR_OFF` | 單次觸發 (Trigger) |
| **駕駛：按壓喇叭** | `KeyH` | 儀表板「喇叭按鈕」按下 | `HORN_PRESS` | 按住持續 (Press & Hold) |
| **駕駛：放開喇叭** | 釋放 `KeyH` | 放開「喇叭按鈕」 | `HORN_RELEASE` | 釋放瞬間 (Release) |
| **路人：發動跳出假摔** | `Space` 或 `Enter` | 畫面中央「⚡ 跳出碰瓷」鈕點擊 | `PEDESTRIAN_JUMP` | 單次觸發 (Trigger) |


---


### 11.3 輸入介面與數據規格 (Input Adapter Specs)


#### 11.3.1 指令與狀態 TypeScript 型別定義


typescript
// 遊戲所有抽象控制指令列舉
type InputCommand = 
  | 'ACCELERATE_DOWN'
  | 'ACCELERATE_UP'
  | 'BRAKE_DOWN'
  | 'BRAKE_UP'
  | 'INDICATOR_LEFT'
  | 'INDICATOR_RIGHT'
  | 'INDICATOR_OFF'
  | 'HORN_PRESS'
  | 'HORN_RELEASE'
  | 'PEDESTRIAN_JUMP';


// 當前駕駛即時輸入狀態快照 (Polling 使用)
interface InputState {
  isAccelerating: boolean;          // 當前是否按住加速
  isBraking: boolean;               // 當前是否按住煞車
  indicatorState: 'OFF' | 'LEFT' | 'RIGHT'; // 當前方向燈狀態
  isHornPressed: boolean;           // 當前是否按住喇叭
}


// 輸入轉譯器抽象介面 (Adapter Pattern)
interface IInputAdapter {
  // 訂閱單次指令事件
  onCommand(callback: (command: InputCommand) => void): () => void;
  
  // 取得當前輸入狀態快照 (Pure Read)
  getCurrentState(): InputState;
  
  // 重置狀態 (用於關卡切換或暫停)
  reset(): void;
  
  // 解構與清除事件監聽器
  dispose(): void;
}



---


### 11.4 TDD 單元測試專用 MockInputAdapter (Headless Injection)


在進行 TDD 單元測試時，為了完全模擬玩家的操作序列而無需真實 DOM 環境，系統實作 Headless 專用的 `MockInputAdapter`：


typescript
/**
 * 專供 TDD 單元測試注入的 Mock 輸入轉譯器
 * 允許測試腳本以程式碼直接注入 InputCommand 或強制覆寫 InputState
 */
class MockInputAdapter implements IInputAdapter {
  private commandListeners: Array<(command: InputCommand) => void> = [];
  private currentState: InputState = {
    isAccelerating: false,
    isBraking: false,
    indicatorState: 'OFF',
    isHornPressed: false
  };


  public onCommand(callback: (command: InputCommand) => void): () => void {
    this.commandListeners.push(callback);
    return () => {
      this.commandListeners = this.commandListeners.filter(cb => cb !== callback);
    };
  }


  public getCurrentState(): InputState {
    return { ...this.currentState };
  }


  /**
   * 測試專用 API：模擬玩家發送指令
   */
  public emitCommand(command: InputCommand): void {
    // 依據指令更新內部快照
    switch (command) {
      case 'ACCELERATE_DOWN': this.currentState.isAccelerating = true; break;
      case 'ACCELERATE_UP': this.currentState.isAccelerating = false; break;
      case 'BRAKE_DOWN': this.currentState.isBraking = true; break;
      case 'BRAKE_UP': this.currentState.isBraking = false; break;
      case 'HORN_PRESS': this.currentState.isHornPressed = true; break;
      case 'HORN_RELEASE': this.currentState.isHornPressed = false; break;
      case 'INDICATOR_LEFT':
        this.currentState.indicatorState = 
          this.currentState.indicatorState === 'LEFT' ? 'OFF' : 'LEFT';
        break;
      case 'INDICATOR_RIGHT':
        this.currentState.indicatorState = 
          this.currentState.indicatorState === 'RIGHT' ? 'OFF' : 'RIGHT';
        break;
      case 'INDICATOR_OFF':
        this.currentState.indicatorState = 'OFF';
        break;
    }


    // 廣播給所有訂閱者
    for (const listener of this.commandListeners) {
      listener(command);
    }
  }


  public reset(): void {
    this.currentState = {
      isAccelerating: false,
      isBraking: false,
      indicatorState: 'OFF',
      isHornPressed: false
    };
  }


  public dispose(): void {
    this.commandListeners = [];
  }
}



---


### 11.5 訊號去顫與多鍵併發處理 (Signal Debouncing & Key Conflict)


#### 11.5.1 多鍵併發與優先權機制 (Conflict Resolution)
在實際操作中，玩家可能同時按下衝突的按鍵（例如：同時按住加速 `ArrowUp` 與煞車 `Space`）：


1. **加速與煞車衝突**：
   * `InputAdapter` 記錄 `isAccelerating = true` 且 `isBraking = true`。
   * 物理引擎更新時，貫徹第 9 章規範之 **煞車絕對優先原則**：強行將淨加速度設為負向煞車減速度，防止車輛在踩煞車時依然向前暴衝。
2. **左轉燈與右轉燈衝突**：
   * 若方向燈當前為 `LEFT` 時按下 `INDICATOR_RIGHT`，轉譯器會自動取消左轉燈，直接將狀態切換為 `RIGHT`，防止同時開啟雙跳黃燈而引發導航校驗歧義。


#### 11.5.2 長按與連發防呆 (Press-and-Hold Filtering)
* 瀏覽器鍵盤事件在長按按鍵時會重複發送 `keydown` 事件。
* `KeyboardInputAdapter` 內部維護一組按鍵狀態 Set (`pressedKeys`)：
  * 當監聽到 `keydown` 且該 Key 已存在於 Set 時，直接過濾掉該重複事件，避免重複觸發 `INDICATOR_LEFT` 導致方向燈瘋狂開關。
  * 只有在 `keyup` 事件觸發並將 Key 從 Set 移除後，方可接受下一次按壓。




# 第 12 章：極端邊界案例矩陣 (Edge Cases Matrix for TDD Assertions)


### 12.1 物理與時間離散邊界案例 (Physics & Discrete Timestep Edge Cases)


在離散時間引擎 ($1\text{ Tick} = 16.667\text{ ms}$) 中，極端輸入或壓線邊界容易引發狀態未定義或測試忽過忽不過 (Flaky Tests) 的問題。本節規範物理系統對極端情境的預期行為與 TDD 斷言。


#### 1. 同時按住加速與煞車 (`ACCELERATE_DOWN` + `BRAKE_DOWN`)
* **系統預期行為**：貫徹**煞車絕對優先權**原則。系統忽略加速輸入，將當前加速度設定為負向煞車減速度 $a = -a_{brake} \times (1 + \text{brakeLevel} \times 0.05)$，車速必須持續下降。
* **TDD 斷言規格**：
  typescript
  expect(nextPhysicsState.velocityMps.x).toBeLessThan(currentPhysicsState.velocityMps.x);
  


#### 2. 倒數 0 秒與碰撞事故於同一個 Tick 發生
* **系統預期行為**：車禍碰撞事件 (`COLLISION_OCCURRED`) 的優先權高於倒數超時 (`TIMEOUT`)。系統應優先轉移至 `IN_GAME_PAUSED_ACCIDENT` 強制進入法庭判決，不觸發關卡時間到的失敗流程。
* **TDD 斷言規格**：
  typescript
  expect(fsm.getCurrentState()).toBe('IN_GAME_PAUSED_ACCIDENT');
  expect(gameLogs).not.toContain('LEVEL_TIMEOUT_EVENT');
  


#### 3. 超高車速下的子彈穿牆效應 (Tunneling / High-Speed Boundary)
* **系統預期行為**：即使車速達到最高速 $V_{max}$，在單一 Tick 移動距離 $\Delta x = V_{max} \cdot \Delta t$ 跨越路人包圍盒時，AABB 檢測仍必須正確擷取相交狀態，嚴禁發生物理穿透現象。
* **TDD 斷言規格**：
  typescript
  expect(checkAABBCollision(vehicleBoxAtNextTick, pedestrianBox)).toBe(true);
  


#### 4. 車輛靜止狀態下被路人撞擊 ($V_{impact} = 0\text{ m/s}$)
* **系統預期行為**：衝擊能量 $E_{impact} = 0 \times W \times A = 0$。路人扣血 $HP_{loss} = 0$，車損 $Vehicle_{loss} = 0$，基礎賠償 $Payout_{base} = 0$。雖然法庭仍會判決，但最終移轉金額與扣血均為 $0$。
* **TDD 斷言規格**：
  typescript
  expect(result.impactEnergy).toBe(0);
  expect(result.pedestrianHpLoss).toBe(0);
  expect(result.payoutAmount).toBe(0);
  


---


### 12.2 法律責任與壓線判定邊界 (Judgement & Ambiguous Zone Edge Cases)


時間差 $T_{diff}$ 的微小變化會劇烈改變責任歸屬，TDD 測試必須對關鍵 Tick 點進行精確斷言：


#### 1. 精確 $T_{diff} = 57\text{ Ticks}$ (灰色區間下界之外，確定性路人全責)
* **系統預期行為**：$T_{diff} < 58$，函數內部歸納 `isAmbiguousZone = false`。判定為路人過失/假車禍，$Fault_{base} = 0.0$（路人 100% 全責，駕駛 0% 責任）。
* **TDD 斷言規格**：
  typescript
  expect(result.isAmbiguousZone).toBe(false);
  expect(result.finalDriverFaultRatio).toBe(0.0);
  


#### 2. 精確 $T_{diff} = 63\text{ Ticks}$ (灰色區間上界之外，確定性駕駛全責)
* **系統預期行為**：$T_{diff} > 62$，函數內部歸納 `isAmbiguousZone = false`。判定為駕駛反應不及過失，$Fault_{base} = 1.0$（駕駛 100% 全責）。
* **TDD 斷言規格**：
  typescript
  expect(result.isAmbiguousZone).toBe(false);
  expect(result.finalDriverFaultRatio).toBe(1.0);
  


#### 3. 黃燈壓線區間 ($58 \le T_{diff} \le 62$，例：$T_{diff} = 60$)
* **系統預期行為**：函數內部歸納 `isAmbiguousZone = true`，採用呼叫端傳入的 `policeRngValue` 作為 $Fault_{base}$（不得由函數自行推導 ticks 以外的判斷）。
* **TDD 斷言規格**（同一 ticks 值，不同 `policeRngValue` 必須得到不同結果，證明函數確實信任傳入值而非寫死）：
  typescript
  expect(calculateCollision({ ...base, timeDiffTicks: 60, policeRngValue: 0.0 }).finalDriverFaultRatio).toBe(0.0);
  expect(calculateCollision({ ...base, timeDiffTicks: 60, policeRngValue: 0.42 }).finalDriverFaultRatio).toBe(0.42);
  // 未傳入 policeRngValue 時，保底預設 0.5（此行為僅用於防禦，測試斷言不得依賴它）
  expect(calculateCollision({ ...base, timeDiffTicks: 60 }).finalDriverFaultRatio).toBe(0.5);
  


#### 4. 辯解修正溢位邊界 ($Fault_{base} + \text{ArgBonus} > 1.0$ 或 $< 0.0$)
* **系統預期行為**：路人辯解極高使計算中間值達 $1.35$ 時，最終責任比率必須被強行 Clamp 限制在 $1.00$ ($100\%$)；反之中間值為 $-0.25$ 時，必須 Clamp 至 $0.00$ ($0\%$)。
* **TDD 斷言規格**：
  typescript
  expect(result.finalDriverFaultRatio).toBeLessThanOrEqual(1.0);
  expect(result.finalDriverFaultRatio).toBeGreaterThanOrEqual(0.0);
  


---


### 12.3 經濟與資產破產邊界 (Economy & Bankruptcy Edge Cases)


#### 1. 金錢精確等於 $\$0$
* **系統預期行為**：$\$0$ 為合法非負資產狀態，**不屬於破產**。遊戲允許繼續留在整備大廳，但若 HP $< 50$ 且無足夠金錢修復時，才會於進關卡驗收時觸發破產。
* **TDD 斷言規格**：
  typescript
  expect(fsm.getCurrentState()).not.toBe('GAME_OVER_HARD_RESET');
  


#### 2. 責任比率精確等於 $Fault_{driver} = 0.50$ (責任各半點)
* **系統預期行為**：依據第 3 章單向互斥規則，$Fault_{driver} \ge 0.50$ 屬於「駕駛主要過失」。駕駛支付賠償金 $Payout = \lfloor Payout_{base} \times 0.50 \rfloor$，路人罰金 $Penalty = 0$。
* **TDD 斷言規格**：
  typescript
  expect(result.payoutAmount).toBeGreaterThan(0);
  expect(result.penaltyAmount).toBe(0);
  


#### 3. 戰前檢查 HP 精確等於 $50\%$ (門檻壓線)
* **系統預期行為**：$\text{HP} \ge 50$ 門檻包含 $50$。驗收直接通過 (Pass)，無需扣除金錢修復即可進入關卡。
* **TDD 斷言規格**：
  typescript
  const check = validatePreGameAccess({ role: 'DRIVER', hp: 50, money: 0, repairConfig: repairCostConfig });
  expect(check.canPass).toBe(true);
  expect(check.deductedMoney).toBe(0);
  


#### 4. 戰前檢查 HP 等於 $49\%$ 且金錢不足支付 $1\text{ HP}$ 修復費
* **系統預期行為**：無法通過戰前檢查，且金錢不足以補充至 $50$，立即觸發 `BANKRUPT_RESET` 破產重置流程。
* **TDD 斷言規格**：
  typescript
  const check = validatePreGameAccess({ role: 'DRIVER', hp: 49, money: 0, repairConfig: repairCostConfig });
  expect(check.canPass).toBe(false);
  expect(check.triggerBankrupt).toBe(true);
  


---


### 12.4 TDD 極端邊界斷言對照矩陣表 (Edge Cases Matrix Table)


| 分類領域 | 極端邊界情境 (Edge Case) | 關鍵輸入條件 (Input State) | 期望結果 / 狀態轉移 | TDD 斷言 Target (Expected Assertion) |
| :--- | :--- | :--- | :--- | :--- |
| **物理** | 雙鍵併發 | `isAccelerating: true`, `isBraking: true` | 煞車優先，車速下降 | `expect(vx_next).toBeLessThan(vx_curr)` |
| **物理** | 靜止碰瓷 | `impactSpeedMps: 0.0` | 衝擊能量與金額皆為 0 | `expect(impactEnergy).toBe(0)` |
| **時間** | 同 Tick 雙事件 | `currentTick` 時倒數歸零且發生碰撞 | 事故判決優先於超時失敗 | `expect(fsmState).toBe('IN_GAME_PAUSED_ACCIDENT')` |
| **法律** | 灰色區間下界外 | `timeDiffTicks: 57` | 路人過失，駕駛 0% 責任，`isAmbiguousZone=false` | `expect(finalDriverFaultRatio).toBe(0.0)` |
| **法律** | 灰色區間上界外 | `timeDiffTicks: 63` | 駕駛過失，駕駛 100% 責任，`isAmbiguousZone=false` | `expect(finalDriverFaultRatio).toBe(1.0)` |
| **法律** | 黃燈區間中點 | `timeDiffTicks: 60`, `policeRngValue: 0.42` | `isAmbiguousZone=true`，採用 RNG 數值 0.42 | `expect(finalDriverFaultRatio).toBe(0.42)` |
| **法律** | 黃燈區間缺值保底 | `timeDiffTicks: 60`（未傳 `policeRngValue`） | 保底 50/50，僅防禦用，不作為斷言依據 | `expect(finalDriverFaultRatio).toBe(0.5)` |
| **法律** | 責任溢位 Clamp | 計算中間值 $Fault = 1.45$ | 限制上限為 $1.00$ | `expect(finalDriverFaultRatio).toBe(1.00)` |
| **經濟** | 責任各半門檻 | $Fault_{driver} = 0.50$ | 駕駛付 $Payout$，路人 $Penalty = 0$ | `expect(payoutAmount).toBeGreaterThan(0)` |
| **經濟** | 資產歸零 | `money: 0` | 狀態正常，不觸發破產 | `expect(fsmState).not.toBe('GAME_OVER_HARD_RESET')` |
| **戰前** | HP 門檻合格 | `hp: 50`, `money: 0` | 通過檢查，零扣款開局 | `expect(check.canPass).toBe(true)` |
| **戰前** | HP 門檻破產 | `hp: 49`, `money: 0` | 檢查失敗，觸發破產重置 | `expect(check.triggerBankrupt).toBe(true)` |


---


### 12.5 極端案例單元測試範例碼 (TypeScript / Vitest Unit Tests)


以下為供工程團隊直接貼入 `src/tests/judgement_edge_cases.test.ts` 的標準單元測試程式碼：


typescript
import { describe, it, expect } from 'vitest';
import { calculateCollision } from '../core/judgement/collisionEngine';
import { processTurnError } from '../core/navigation/turnSystem';


describe('第 12 章：極端邊界案例 TDD 單元測試集', () => {


  describe('12.2 法律責任與壓線判定邊界測試', () => {


    const baseInput = {
      impactSpeedMps: 15.0,
      vehicleWeightClass: 1.0,
      impactZone: 'FRONT' as const,
      driverArgLevel: 1,
      pedestrianArgLevel: 1,
      driverBrakeLevel: 1,
      pedestrianDodgeLevel: 1
    };


    it('邊界 1：timeDiffTicks = 57 (灰色區間下界之外) 應判決駕駛 0% 責任', () => {
      const output = calculateCollision({ ...baseInput, timeDiffTicks: 57 });


      expect(output.isAmbiguousZone).toBe(false);
      expect(output.finalDriverFaultRatio).toBe(0.0);
      expect(output.payoutAmount).toBe(0);
      expect(output.penaltyAmount).toBeGreaterThan(0); // 路人付罰金
    });


    it('邊界 2：timeDiffTicks = 63 (灰色區間上界之外) 應判決駕駛 100% 責任', () => {
      const output = calculateCollision({ ...baseInput, timeDiffTicks: 63 });


      expect(output.isAmbiguousZone).toBe(false);
      expect(output.finalDriverFaultRatio).toBe(1.0);
      expect(output.payoutAmount).toBeGreaterThan(0); // 駕駛付賠償金
      expect(output.penaltyAmount).toBe(0);
    });


    it('邊界 3：黃燈區間 (timeDiffTicks = 60) 應信任傳入之 policeRngValue，而非寫死判定', () => {
      const zeroFault = calculateCollision({ ...baseInput, timeDiffTicks: 60, policeRngValue: 0.0 });
      const midFault = calculateCollision({ ...baseInput, timeDiffTicks: 60, policeRngValue: 0.42 });


      expect(zeroFault.isAmbiguousZone).toBe(true);
      expect(zeroFault.finalDriverFaultRatio).toBe(0.0);
      expect(midFault.isAmbiguousZone).toBe(true);
      expect(midFault.finalDriverFaultRatio).toBe(0.42);
    });


    it('邊界 3b：黃燈區間缺少 policeRngValue 時保底為 0.5（僅防禦性行為，不作為業務斷言依據）', () => {
      const output = calculateCollision({ ...baseInput, timeDiffTicks: 60 });


      expect(output.isAmbiguousZone).toBe(true);
      expect(output.finalDriverFaultRatio).toBe(0.5);
    });


    it('邊界 4：辯解修正值溢位時應正確 Clamp 在 [0.0, 1.0] 區間', () => {
      const outputHigh = calculateCollision({
        ...baseInput,
        timeDiffTicks: 65, // Fault_base = 1.0
        pedestrianArgLevel: 10 // 路人辯解超高 (+0.45)
      });


      // 1.0 + 0.45 = 1.45 -> Clamp 至 1.0
      expect(outputHigh.finalDriverFaultRatio).toBe(1.0);
    });


  });


  describe('12.3 導航降關與重試次數邊界測試', () => {


    it('連續轉錯第 1 與第 2 次時，應重試當前關卡不降關', () => {
      const res1 = processTurnError(0, 3);
      expect(res1.nextRetryCount).toBe(1);
      expect(res1.nextLevelId).toBe(3);
      expect(res1.isDowngraded).toBe(false);


      const res2 = processTurnError(1, 3);
      expect(res2.nextRetryCount).toBe(2);
      expect(res2.nextLevelId).toBe(3);
      expect(res2.isDowngraded).toBe(false);
    });


    it('連續轉錯第 3 次時，應觸發自動降關且重試計數器歸零', () => {
      const res3 = processTurnError(2, 3); // 第 3 次轉錯
      expect(res3.nextRetryCount).toBe(0);
      expect(res3.nextLevelId).toBe(2); // 關卡從 3 降至 2
      expect(res3.isDowngraded).toBe(true);
    });


    it('在第 1 關連續轉錯 3 次時，降關下限應保持在 Level 1', () => {
      const resAtLevel1 = processTurnError(2, 1);
      expect(resAtLevel1.nextLevelId).toBe(1); // 不降至 0 關
      expect(resAtLevel1.nextRetryCount).toBe(0);
    });


  });


});





# 第 13 章：本地存儲 Schema 與預設初始狀態 (LocalStorage Schema & Default Initial State)


### 13.1 本地存儲設計哲學與 Key 命名規範 (Storage Philosophy & Key Naming)


為了確保遊戲存檔在瀏覽器環境下的高穩定性、可升級性以及防止版本升級導致的 Schema 衝突，本地存儲系統遵守以下設計規範：


* **版本化 Key 命名 (Versioned Storage Key)**：
  * 本地存儲主 Key 嚴格統一命名為 `CAR_VS_PEDESTRIAN_SAVE_v1`。
  * 若未來發布重大不相容更新（Break Changes），Key 名稱將升級為 `..._v2`，防止舊版髒資料導致新版遊戲 crash。
* **資料序列化格式**：
  * 所有記憶體內部的 TypeScript 物件，寫入 `localStorage` 前全數透過 `JSON.stringify()` 序列化為 UTF-8 字串。
  * 讀取時進行 `JSON.parse()` 解析，並搭配 Validator / Sanitizer 進行屬性保底驗證。
* **讀寫頻率控管 (Write Throttling)**：
  * 遊戲運行中（`IN_GAME_RUNNING` 每 Tick）**嚴禁進行 `localStorage` 寫入**，以防 I/O 阻塞造成掉幀。
  * 存檔寫入動作僅於特定狀態節點觸發：
    1. 完成能力升級或購買車輛後。
    2. 車禍碰撞法庭判決完成 (`CONFIRM_VERDICT`) 後。
    3. 關卡通關或觸發破產重置 (`HardReset`) 時。


---


### 13.2 完整 TypeScript Save Schema 定義 (Save Data Interfaces)


存檔結構嚴格維護「駕駛 (`driver`)」與「路人 (`pedestrian`)」雙軌資料隔離，結構定義如下：


typescript
// 單一關卡歷史最佳紀錄
interface LevelRecord {
  isPassed: boolean;               // 是否已順利通關
  bestTimeSeconds?: number;        // 駕駛模式：最佳抵達用時 (秒)
  totalPayoutPaid?: number;        // 駕駛模式：該關累積支付賠償金 ($)
  maxSinglePayout?: number;        // 路人模式：單次碰瓷獲得之最高賠償金 ($)
  playCount: number;               // 該關卡累計遊玩次數
}


// 駕駛角色存檔結構
interface DriverProfile {
  currentLevel: number;            // 當前最新解鎖/進行關卡 ID (從 1 開始)
  money: number;                   // 駕駛當前總資產金額 ($)
  vehicleHp: number;               // 當前車輛耐久度 (0 ~ 100)
  selectedVehicleId: string;       // 當前裝備的車輛 ID (例: 'default_sedan')
  unlockedVehicleIds: string[];    // 已購買解鎖的車輛 ID 清單
  stats: {
    brakeLevel: number;            // 煞車能力等級 (1 ~ 10)
    hornLevel: number;             // 喇叭威力等級 (1 ~ 10)
    defenseArgLevel: number;       // 法庭辯解能力等級 (1 ~ 10)
  };
  levelRecords: Record<number, LevelRecord>; // 各關卡歷史紀錄 (Key 為 levelId)
}


// 路人角色存檔結構
interface PedestrianProfile {
  currentLevel: number;            // 當前最新解鎖/進行關卡 ID (從 1 開始)
  money: number;                   // 路人當前總資產金額 ($)
  hp: number;                      // 當前路人體力/血量 (0 ~ 100)
  stats: {
    speedLevel: number;            // 移動速度等級 (1 ~ 10)
    dodgeLevel: number;            // 假摔閃避等級 (1 ~ 10)
    defenseArgLevel: number;       // 索賠辯解能力等級 (1 ~ 10)
  };
  levelRecords: Record<number, LevelRecord>; // 各關卡歷史紀錄 (Key 為 levelId)
}


// 全域遊戲存檔主結構
interface GameSaveData {
  version: string;                 // 存檔 Schema 版本號 (例: '1.0.0')
  lastSavedTimestamp: number;      // 上次存檔的 UNIX 毫秒時間戳記
  activeRole: 'DRIVER' | 'PEDESTRIAN'; // 上次離線時選擇的角色
  driver: DriverProfile;
  pedestrian: PedestrianProfile;
}



---


### 13.3 預設初始存檔常數 (INITIAL_GAME_SAVE)


當玩家首次開開啟遊戲、存檔損壞無法修復，或觸發 `HardReset()` 破產硬重置時，系統寫入以下預設常數：


typescript
export const INITIAL_GAME_SAVE: Readonly<GameSaveData> = Object.freeze({
  version: '1.0.0',
  lastSavedTimestamp: 0,
  activeRole: 'DRIVER',
  
  driver: {
    currentLevel: 1,
    money: 1000,                  // 初始開局資產 $1,000
    vehicleHp: 100,               // 初始滿耐久度 100
    selectedVehicleId: 'default_sedan',
    unlockedVehicleIds: ['default_sedan'],
    stats: {
      brakeLevel: 1,              // 預設等級 1
      hornLevel: 1,
      defenseArgLevel: 1
    },
    levelRecords: {
      1: {
        isPassed: false,
        playCount: 0
      }
    }
  },
  
  pedestrian: {
    currentLevel: 1,
    money: 0,                     // 初始碰瓷白手起家 $0
    hp: 100,                      // 初始滿血量 100
    stats: {
      speedLevel: 1,              // 預設等級 1
      dodgeLevel: 1,
      defenseArgLevel: 1
    },
    levelRecords: {
      1: {
        isPassed: false,
        playCount: 0
      }
    }
  }
});



---


### 13.4 資料遷移與修復純函數 (Migration & Fail-Safe)


為了確保舊版存檔能在新版程式碼下正常運作，系統提供純函數 `validateAndMigrateSaveData`。當讀取存檔時發現缺失欄位或版本不符合，自動進行補充與修復，避免拋出 runtime 錯誤：


typescript
/**
 * 純函數：修復與遷移不完整的原始存檔 JSON 物件 (無外部副作用)
 * @param rawData 讀取到的未知資料 (可能是舊版、缺欄位或非法的物件)
 * @returns 符合目前 GameSaveData 規格的合法物件
 */
function validateAndMigrateSaveData(rawData: unknown): GameSaveData {
  // 1. 若資料非物件或為 null，直接回傳預設 Initial Save
  if (typeof rawData !== 'object' || rawData === null) {
    return { ...INITIAL_GAME_SAVE, lastSavedTimestamp: Date.now() };
  }


  const data = rawData as Partial<GameSaveData>;


  // 2. 基礎版本與基本結構修復
  const migrated: GameSaveData = {
    version: '1.0.0',
    lastSavedTimestamp: typeof data.lastSavedTimestamp === 'number' ? data.lastSavedTimestamp : Date.now(),
    activeRole: data.activeRole === 'PEDESTRIAN' ? 'PEDESTRIAN' : 'DRIVER',
    
    // 駕駛角色保底修復
    driver: {
      currentLevel: Math.max(1, data.driver?.currentLevel ?? INITIAL_GAME_SAVE.driver.currentLevel),
      money: typeof data.driver?.money === 'number' ? data.driver.money : INITIAL_GAME_SAVE.driver.money,
      vehicleHp: Math.max(0, Math.min(100, data.driver?.vehicleHp ?? INITIAL_GAME_SAVE.driver.vehicleHp)),
      selectedVehicleId: data.driver?.selectedVehicleId ?? INITIAL_GAME_SAVE.driver.selectedVehicleId,
      unlockedVehicleIds: Array.isArray(data.driver?.unlockedVehicleIds) 
        ? data.driver.unlockedVehicleIds 
        : [...INITIAL_GAME_SAVE.driver.unlockedVehicleIds],
      stats: {
        brakeLevel: Math.max(1, data.driver?.stats?.brakeLevel ?? 1),
        hornLevel: Math.max(1, data.driver?.stats?.hornLevel ?? 1),
        defenseArgLevel: Math.max(1, data.driver?.stats?.defenseArgLevel ?? 1)
      },
      levelRecords: data.driver?.levelRecords ?? { ...INITIAL_GAME_SAVE.driver.levelRecords }
    },


    // 路人角色保底修復
    pedestrian: {
      currentLevel: Math.max(1, data.pedestrian?.currentLevel ?? INITIAL_GAME_SAVE.pedestrian.currentLevel),
      money: typeof data.pedestrian?.money === 'number' ? data.pedestrian.money : INITIAL_GAME_SAVE.pedestrian.money,
      hp: Math.max(0, Math.min(100, data.pedestrian?.hp ?? INITIAL_GAME_SAVE.pedestrian.hp)),
      stats: {
        speedLevel: Math.max(1, data.pedestrian?.stats?.speedLevel ?? 1),
        dodgeLevel: Math.max(1, data.pedestrian?.stats?.dodgeLevel ?? 1),
        defenseArgLevel: Math.max(1, data.pedestrian?.stats?.defenseArgLevel ?? 1)
      },
      levelRecords: data.pedestrian?.levelRecords ?? { ...INITIAL_GAME_SAVE.pedestrian.levelRecords }
    }
  };


  return migrated;
}



---


### 13.5 StorageAdapter 抽象與記憶體 Mock 實作 (Storage Adapter Pattern)


為了確保 `src/core/` 純邏輯層與 `localStorage` 徹底解耦，且單元測試能順暢執行，寫入與讀取全數透過 `IStorageAdapter` 介面：

**檔案目錄歸屬（2026-07-22 定案，回應 Q20.7）**：
* `src/core/storage/StorageAdapter.ts`：僅包含下方 `IStorageAdapter` 介面與測試用 `MemoryStorageAdapter`（§13.5 對應程式碼）。
* `src/adapters/WebStorageAdapter.ts`：包含下方會實際存取 `window.localStorage` 的 `WebLocalStorageAdapter`（不算入 `src/core/` 100% 覆蓋率要求，也不受鐵律 1 的「嚴禁存取 localStorage」限制）。


typescript
// 抽象存儲轉接器介面
interface IStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}


// 1. 實際 Web 瀏覽器環境轉接器（歸屬 src/adapters/WebStorageAdapter.ts，非 src/core/）
class WebLocalStorageAdapter implements IStorageAdapter {
  getItem(key: string): string | null {
    try {
      return localStorage.getItem(key);
    } catch {
      return null; // 防範無痕模式阻擋 localStorage 存取
    }
  }


  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      console.warn('Storage write failed (QuotaExceeded or PrivateMode)', e);
    }
  }


  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {}
  }


  clear(): void {
    try {
      localStorage.clear();
    } catch {}
  }
}


// 2. 專供 TDD 單元測試注入的記憶體轉接器 (In-Memory Mock)
class MemoryStorageAdapter implements IStorageAdapter {
  private memoryStore = new Map<string, string>();


  getItem(key: string): string | null {
    return this.memoryStore.get(key) ?? null;
  }


  setItem(key: string, value: string): void {
    this.memoryStore.set(key, value);
  }


  removeItem(key: string): void {
    this.memoryStore.delete(key);
  }


  clear(): void {
    this.memoryStore.clear();
  }
}





# 第 14 章：程式碼架構與 TDD 開發規範 (Architecture & TDD Guidelines)


### 14.1 專案目錄結構與分層職責 (Directory Structure & Layering)


本專案嚴格貫徹 **關注點分離 (Separation of Concerns)** 與 **領域驅動設計 (Domain-Driven Design, DDD)** 概念，將遊戲劃分為「純邏輯核心層 (`src/core/`)」與「視圖/轉接頭層 (`src/ui/` & `src/adapters/`)」。


核心原則：**`src/core/` 必須保持 $100\%$ 框架無關、平台無關、無副作用，可直接在 Node.js 無頭 (Headless) 環境下進行快速單元測試。**


text
src/
├── core/                        # 純邏輯核心層 (100% Pure TypeScript, 0% DOM Dependencies)
│   ├── engine/                  # 離散時間與狀態機引擎
│   │   ├── TickEngine.ts        # 離散 60 FPS 時間步長驅動器
│   │   └── GameFSM.ts           # 有限狀態機 (FSM) 管理器
│   ├── physics/                 # 座標與運動學物理引擎
│   │   ├── Coordinates.ts       # 二維世界座標與單位轉換 (m <-> px)
│   │   ├── CollisionDetector.ts # AABB 包圍盒碰撞檢測器
│   │   └── VehiclePhysics.ts    # 車輛歐拉積分運動學計算
│   ├── judgement/               # 法律灰色地帶與判決計算
│   │   ├── collisionEngine.ts   # 衝擊能量 E_impact & 責任 Fault 純函數
│   │   └── roundingRules.ts     # 取整 Math.floor & 金額單向互斥計算
│   ├── navigation/              # 導航與路口方向燈校驗
│   │   └── turnSystem.ts        # 方向燈比對與降關遞迴演算法
│   ├── events/                  # 隨機事件與可重現 PRNG
│   │   ├── SeededRNG.ts         # Mulberry32 偽隨機數產生器
│   │   └── RandomEventManager.ts# 機率事件換算與效果疊加處理器
│   ├── progression/             # 局外養成與戰前檢查
│   │   ├── statUpgrades.ts      # 能力指數費用計算純函數
│   │   └── preGameCheck.ts      # 門檻驗收與強修復邏輯
│   ├── level/                   # 數據驅動關卡生成
│   │   └── levelConfig.ts       # 關卡數值 Scaling 生成器
│   └── storage/                 # 資料持久化介面與 Schema
│       ├── saveSchema.ts        # TypeScript Save Interfaces & 常數
│       └── StorageAdapter.ts    # IStorageAdapter 抽象介面
│
├── ui/                          # 視圖渲染與 DOM/Canvas 繪製層
│   ├── canvas/                  # Canvas 2D 畫布渲染器
│   │   ├── DriverRenderer.ts    # Pseudo-3D 駕駛視角與 Sub-Canvas 後照鏡
│   │   └── PedestrianRenderer.ts# 2D 俯瞰 Top-down 畫面與預備點
│   ├── components/              # HTML/DOM 視圖元件
│   │   ├── CourtVerdictModal.ts # 法庭判決書彈窗與印章動畫
│   │   ├── GarageScreen.ts      # 整備大廳 UI
│   │   └── HUDOverlay.ts        # 時速表、方向燈與導航箭頭
│   └── audio/                   # WebAudio 音效播放器
│       └── WebAudioAdapter.ts   # IFeedbackAdapter 瀏覽器實作
│
├── adapters/                    # 硬體與平台適配器
│   ├── KeyboardAdapter.ts       # PC 鍵盤對抽象 InputCommand 轉譯器
│   ├── TouchAdapter.ts          # 行動端虛擬按鈕轉譯器
│   └── WebStorageAdapter.ts     # localStorage 轉接器
│
└── tests/                       # TDD 單元測試集 (100% 覆蓋 src/core/)
    ├── engine.test.ts
    ├── physics.test.ts
    ├── judgement.test.ts
    ├── navigation.test.ts
    ├── random_event.test.ts
    ├── progression.test.ts
    └── storage.test.ts



---


### 14.2 TDD 開發流程與三大鐵律 (TDD Workflow & Three Golden Rules)


工程團隊在實作任何需求前，必須嚴格遵守以下三大鐵律與 **紅-綠-重構 (Red-Green-Refactor)** 開發迴圈：


text
       ┌───────────────────────────────────────────────────┐
       │ 1. RED (撰寫失敗測試)                             │
       │    依據 SRS 規格於 src/tests/ 撰寫斷言測試程式碼 │
       └─────────────────────────┬─────────────────────────┘
                                 │
                                 ▼
       ┌───────────────────────────────────────────────────┐
       │ 2. GREEN (寫出最小實作)                           │
       │    於 src/core/ 撰寫最精簡程式碼使測試 PASS      │
       └─────────────────────────┬─────────────────────────┘
                                 │
                                 ▼
       ┌───────────────────────────────────────────────────┐
       │ 3. REFACTOR (優化程式碼)                          │
       │    重構結構、提升效能，保持測試 100% PASS         │
       └───────────────────────────────────────────────────┘



#### 鐵律 1：`src/core/` 純函數與零副作用 (Zero Side-Effects Constraint)
* `src/core/` 內部的所有 TypeScript 檔案，**嚴禁出現任何下列語法**：
  * 存取 `window`、`document`、`navigator`、`HTMLElement` 等 DOM 物件。
  * 呼叫原生 `Math.random()`（必須統一傳入 `SeededRNG` 實例）。
  * 直接存取 `localStorage` 或 `sessionStorage` 全局變數。
  * 呼叫 `Date.now()` 或 `performance.now()` 作為物理或遊戲時間比對（必須統一使用 `currentTick`）。


#### 鐵律 2：$100\%$ 可預測與決定性測試 (Deterministic Testing)
* 任何單元測試不得產生不確定結果 (Flaky Tests)。
* 所有涉及隨機性的測試（如：灰色區域警察判決、煞車失靈機率），必須手動注入固定種子 (例如：`new SeededRNG(12345)`) 或寫死 `policeRngValue` 輸入參數。


#### 3. 測試覆蓋率硬性門檻 (100% Coverage Threshold for Core)
* CI/CD 自動化管道構建時，`src/core/` 目錄的**行覆蓋率 (Line Coverage)**、**分支覆蓋率 (Branch Coverage)** 與 **函數覆蓋率 (Function Coverage)** 必須達到 **$100\%$**，否則禁止 Merge 至 `main` 分支。


---


### 14.3 程式碼撰寫與命名規範 (Coding Conventions)


為維護開發庫的一致性與可讀性，TypeScript 命名遵守以下規範：


* **型別與介面**：
  * 抽象介面採用 `I` 開頭 PascalCase，例如：`IStorageAdapter`, `IFeedbackAdapter`, `IGameEntity`。
  * 純資料結構/狀態 Payload 採用 PascalCase 名詞，例如：`CalculateCollisionInput`, `GameSaveData`。
  * 聯合列舉型別 (Union String Types) 採用 UPPER_SNAKE_CASE 內容，例如：`type TurnDirection = 'STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT'`。
* **變數與純函數**：
  * 純函數統一以動詞開頭之 camelCase 命名，例如：`calculateCollision()`, `processTurnError()`。
  * 變數採用 camelCase，物理量必須帶有明確單位後綴：
    * 速度：`speedMps` (公尺/秒)
    * 距離：`distanceMeter` (公尺)
    * 時間：`timeDiffTicks` (Ticks) 或 `timeLimitSeconds` (秒)
* **常數**：
  * 核心數學常數與初始值全數使用全大寫與底線，例如：`INITIAL_GAME_SAVE`, `K_PAYOUT_FACTOR`。


---


### 14.4 CI/CD 與自動化測試指令集 (CI/CD Automation Scripts)


專案採用 **Vitest** 作為單元測試執行器（具備極速 ESM 載入速度與最佳 TypeScript 原生支援）。


#### `package.json` 指令集規格
json
{
  "name": "car-vs-pedestrian",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src --ext .ts"
  },
  "devDependencies": {
    "@vitest/coverage-v8": "^1.0.0",
    "typescript": "^5.0.0",
    "vite": "^5.0.0",
    "vitest": "^1.0.0"
  }
}



#### Vitest 設定檔規格 (`vitest.config.ts`)
typescript
import { defineConfig } from 'vitest/config';


export default defineConfig({
  test: {
    environment: 'node', // 核心測試全數於純 Node.js 無頭環境執行
    include: ['src/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/core/**/*.ts'],
      thresholds: {
        lines: 100,
        functions: 100,
        branches: 100,
        statements: 100
      }
    }
  }
});



# 第 15 章：資料庫與實體欄位詳細定義 (Database Schema & Entity Definitions)


### 15.1 遊戲實體與資料庫關係概述 (Overview of Entities & Schema)


在《車 vs 路人：黑色幽默碰瓷模擬器》中，資料結構分為三大維度：
1. **靜態資料庫設定 (Static Config DB)**：唯讀的基礎資料，如車輛款式選單、預設關卡圖鑑、障礙物原型。
2. **持久化存檔資料庫 (Persistent Save DB)**：記錄於 `localStorage` (經由 `StorageAdapter`) 的玩家進度，包含駕駛與路人各自獨立的資產、能力等級與通關歷程。
3. **動態運行實體 (Dynamic Runtime Entities)**：遊戲進行中於 `TickEngine` 每 16.667ms 進行狀態更新的物件（如：`VehicleEntity`、`PedestrianEntity`、`StrayCatEntity`）。


本章定義所有實體欄位之精確型別、邊界約束 (Constraints) 與預設值，作為 Core 邏輯與 Data Tier 之間的規範。


---


### 15.2 車輛資料庫 Schema與預設陣列 (`VehicleConfig` & `VEHICLE_DATABASE`)


#### 15.2.1 `VehicleConfig` TypeScript 介面定義
typescript
interface VehicleConfig {
  id: string;                      // 車輛唯一識別碼 (例: 'default_sedan')
  name: string;                    // UI 顯示名稱 (例: '平民小房車')
  description: string;             // 車輛簡介說明
  price: number;                   // 解鎖/購買所需金額 ($)
  weightClass: number;             // 車重/衝擊係數 W_vehicle (小型=1.0, 中型=1.3, 卡車=1.8)
  maxSpeedMps: number;             // 最高時速 V_max (m/s, 16.67 m/s = 60 km/h)
  accelerationMps2: number;        // 基礎縱向加速度 a_acc (m/s²)
  brakePowerMps2: number;          // 基礎煞車減速度 a_brake (m/s²)
  maxDurability: number;           // 最高耐久度/HP (標準 100)
  repairCostPerHp: number;         // 每修復 1 點 HP 所需金錢 ($/HP)
  spriteKey: string;               // 繪圖渲染 Asset 識別碼
}



#### 15.2.2 內建車輛靜態資料庫 (`VEHICLE_DATABASE`)
系統內建三款風格與物理特性迥異的車輛供玩家解鎖：


typescript
export const VEHICLE_DATABASE: ReadonlyArray<VehicleConfig> = Object.freeze([
  {
    id: 'default_sedan',
    name: '平民小房車',
    description: '標準配備的小型家用轎車，重量輕、維修費用便宜。',
    price: 0,
    weightClass: 1.0,
    maxSpeedMps: 16.67,            // 60 km/h
    accelerationMps2: 2.5,
    brakePowerMps2: 4.0,
    maxDurability: 100,
    repairCostPerHp: 5,            // 每點修復費 $5
    spriteKey: 'spr_vehicle_sedan'
  },
  {
    id: 'suv_city',
    name: '裝甲家庭 SUV',
    description: '底盤與車身加厚的中型休旅車，衝擊力高但煞車距離略長。',
    price: 2500,
    weightClass: 1.3,
    maxSpeedMps: 20.0,             // 72 km/h
    accelerationMps2: 2.0,
    brakePowerMps2: 3.5,
    maxDurability: 120,
    repairCostPerHp: 8,            // 每點修復費 $8
    spriteKey: 'spr_vehicle_suv'
  },
  {
    id: 'heavy_truck',
    name: '鋼鐵巨無霸卡車',
    description: '擁有極高衝擊能量的重型卡車，撞擊可造成路人巨大傷害，但維修昂貴。',
    price: 8000,
    weightClass: 1.8,
    maxSpeedMps: 13.89,            // 50 km/h
    accelerationMps2: 1.2,
    brakePowerMps2: 2.5,
    maxDurability: 150,
    repairCostPerHp: 15,           // 每點修復費 $15
    spriteKey: 'spr_vehicle_truck'
  }
]);



---


### 15.3 運行實體數據狀態 Schema (Runtime Entity State)


在 `IN_GAME_RUNNING` 狀態下，`TickEngine` 監控並更新以下動態實體狀態：


#### 15.3.1 駕駛動態實體狀態 (`VehicleRuntimeState`)
typescript
interface VehicleRuntimeState {
  config: VehicleConfig;           // 參照的車輛設定檔
  currentHp: number;               // 即時耐久度/血量 (0 ~ maxDurability)
  positionMeter: { x: number; y: number }; // 世界座標 (m)
  velocityMps: { x: number; y: number };  // 即時物理速度 (m/s)
  currentIndicator: 'OFF' | 'LEFT' | 'RIGHT'; // 方向燈狀態
  isHornBlowing: boolean;          // 當前是否按壓喇叭中
  isBrakeFailing: boolean;         // 是否處於煞車失靈狀態
  boundingBox: { center: { x: number; y: number }; width: number; height: number };
}



#### 15.3.2 路人動態實體狀態 (`PedestrianRuntimeState`)
typescript
interface PedestrianRuntimeState {
  currentHp: number;               // 即時路人血量 (0 ~ 100)
  positionMeter: { x: number; y: number }; // 世界座標 (m)
  velocityMps: { x: number; y: number };  // 即時位移速度 (m/s)
  isJumping: boolean;              // 是否已啟動跳出假摔動作
  isFrozen: boolean;               // 是否被喇叭定身中
  frozenTicksRemaining: number;    // 定身剩餘 Tick 數
  entryLaneTick: number | null;    // 踏入車道的精確 Tick 數
  boundingBox: { center: { x: number; y: number }; width: number; height: number };
}



---


### 15.4 資料庫欄位規格總表 (Data Field Specifications Matrix)


下表為 `GameSaveData`持久化欄位與 `VehicleConfig` 之精確欄位規範總表，提供資料庫設計與型別校驗依據：


| 實體/類別 (`Entity`) | 欄位名稱 (`Field Name`) | 資料型別 (`Type`) | 約束條件 (`Constraints`) | 預設值 (`Default`) | 說明與業務邏輯 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`GameSaveData`** | `version` | `string` | Regex: `^\d+\.\d+\.\d+$` | `'1.0.0'` | Save Schema 版本號。 |
| **`GameSaveData`** | `activeRole` | `string` | `'DRIVER' \| 'PEDESTRIAN'` | `'DRIVER'` | 上次離開時使用的角色模式。 |
| **`DriverProfile`** | `currentLevel` | `number` | 整數，$\ge 1$ | `1` | 最新解鎖的駕駛關卡進度。 |
| **`DriverProfile`** | `money` | `number` | 整數 | `1000` | 駕駛當前總資產，允許為負值（破產前）。 |
| **`DriverProfile`** | `vehicleHp` | `number` | 整數，$0 \le \text{HP} \le 100$ | `100` | 當前車輛殘餘耐久度。 |
| **`DriverProfile`** | `selectedVehicleId` | `string` | 必須存在於 `VEHICLE_DATABASE` | `'default_sedan'` | 當前出戰選擇的車輛 ID。 |
| **`DriverStats`** | `brakeLevel` | `number` | 整數，$1 \le L \le 10$ | `1` | 煞車與減傷能力等級。 |
| **`DriverStats`** | `hornLevel` | `number` | 整數，$1 \le L \le 10$ | `1` | 喇叭定身時間等級。 |
| **`DriverStats`** | `defenseArgLevel` | `number` | 整數，$1 \le L \le 10$ | `1` | 法庭辯解責任扣減等級。 |
| **`PedestrianProfile`**| `currentLevel` | `number` | 整數，$\ge 1$ | `1` | 最新解鎖的路人關卡進度。 |
| **`PedestrianProfile`**| `money` | `number` | 整數，$\ge 0$ | `0` | 路人碰瓷詐騙累積總資產。 |
| **`PedestrianProfile`**| `hp` | `number` | 整數，$0 \le \text{HP} \le 100$ | `100` | 路人身體殘餘血量。 |
| **`PedestrianStats`** | `speedLevel` | `number` | 整數，$1 \le L \le 10$ | `1` | 移動與跳出速度等級。 |
| **`PedestrianStats`** | `dodgeLevel` | `number` | 整數，$1 \le L \le 10$ | `1` | 假摔閃避與減傷等級。 |
| **`PedestrianStats`** | `defenseArgLevel` | `number` | 整數，$1 \le L \le 10$ | `1` | 法庭索賠訴訟辯解等級。 |
| **`VehicleConfig`** | `weightClass` | `number` | 浮點數，$1.0 \le W \le 2.0$ | `1.0` | 碰撞能量計算之重量乘數。 |
| **`VehicleConfig`** | `repairCostPerHp` | `number` | 整數，$\ge 1$ | `5` | 車輛維修費用單價 ($/HP)。 |


---


### 15.5 實體資料驗證與清理純函數 (Data Sanitization Pure Functions)


為防止手動修改存檔、網絡傳輸異常或 JSON 解析錯誤導致髒資料入侵遊戲核心，系統提供純函數驗證機制：


typescript
/**
 * 純函數：校驗與清理 VehicleConfig 物件 (無外部副作用)
 */
function sanitizeVehicleConfig(rawConfig: unknown): VehicleConfig {
  const fallback = VEHICLE_DATABASE[0]; // 預設小房車保底
  if (typeof rawConfig !== 'object' || rawConfig === null) return fallback;


  const config = rawConfig as Partial<VehicleConfig>;


  return {
    id: typeof config.id === 'string' ? config.id : fallback.id,
    name: typeof config.name === 'string' ? config.name : fallback.name,
    description: typeof config.description === 'string' ? config.description : fallback.description,
    price: typeof config.price === 'number' && config.price >= 0 ? config.price : fallback.price,
    weightClass: typeof config.weightClass === 'number' && config.weightClass >= 1.0 ? config.weightClass : fallback.weightClass,
    maxSpeedMps: typeof config.maxSpeedMps === 'number' && config.maxSpeedMps > 0 ? config.maxSpeedMps : fallback.maxSpeedMps,
    accelerationMps2: typeof config.accelerationMps2 === 'number' && config.accelerationMps2 > 0 ? config.accelerationMps2 : fallback.accelerationMps2,
    brakePowerMps2: typeof config.brakePowerMps2 === 'number' && config.brakePowerMps2 > 0 ? config.brakePowerMps2 : fallback.brakePowerMps2,
    maxDurability: typeof config.maxDurability === 'number' && config.maxDurability > 0 ? config.maxDurability : fallback.maxDurability,
    repairCostPerHp: typeof config.repairCostPerHp === 'number' && config.repairCostPerHp > 0 ? config.repairCostPerHp : fallback.repairCostPerHp,
    spriteKey: typeof config.spriteKey === 'string' ? config.spriteKey : fallback.spriteKey
  };
}


/**
 * 純函數：數值邊界修整 Clamp (限制數值在指定範圍內)
 */
function clampEntityStat(value: number, min: number, max: number): number {
  if (isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}





# 第 16 章：UI 畫面流程與狀態遷移說明 (UI Flow & Screen Transitions)


### 16.1 UI 畫面狀態與整體遷移圖 (Screen Hierarchy & Transition Diagram)


本遊戲的 UI 視圖層 (`src/ui/`) 採用與 FSM (有限狀態機) 緊密對齊的狀態驅動架構。畫面遷移完全由 FSM 狀態變更事件觸發，UI 控制器不自行維持獨立的流程邏輯，確保 UI 畫面與核心邏輯狀態 100% 同步。


text
                     ┌────────────────────────┐
                     │   TitleScreen          │
                     │  (標題畫面與角色選擇)   │
                     └───────────┬────────────┘
                                 │
                 ┌───────────────┴───────────────┐
                 ▼                               ▼
    [ 選擇駕駛 (Driver) ]             [ 選擇路人 (Pedestrian) ]
                 │                               │
                 ▼                               ▼
    ┌────────────────────────┐      ┌────────────────────────┐
    │  GarageScreen (Driver) │      │GarageScreen(Pedestrian)│
    │  (駕駛整備與車輛商城)  │      │  (路人整備與場景選擇)  │
    └───────────┬────────────┘      └───────────┬────────────┘
                │                               │
                └───────────────┬───────────────┘
                                │ (點擊開始 & 通過 PreGameCheck)
                                ▼
                    ┌────────────────────────┐
                    │      InGameHUD         │
                    │   (遊戲內實時 UI 畫面)  │
                    └───────────┬────────────┘
                                │
                 ┌──────────────┴──────────────┐
                 │ (發生車禍碰撞)               │ (安全抵達 / 達標)
                 ▼                             ▼
    ┌────────────────────────┐    ┌────────────────────────┐
    │     VerdictModal       │    │   LevelResultScreen    │
    │  (事故責任判決書彈窗)  │    │   (關卡通關結算畫面)   │
    └───────────┬────────────┘    └───────────┬────────────┘
                │                             │
    ┌───────────┴───────────┐                 │
    │ (確認結算)            │ (資金負值/殘血)  │
    ▼                       ▼                 │
[ 返回 Garage ]    ┌──────────────────┐       │
                   │  BankruptModal   │       │
                   │ (破產清算強重置) │       │
                   └────────┬─────────┘       │
                            │                 │
                            └─────────────────┴─────► [ 返回 TitleScreen ]



---


### 16.2 UI 畫面詳細元件與使用者交互 (Detailed UI Components & User Interactions)


#### 16.2.1 標題與角色選擇畫面 (`TitleScreen`)
* **主要元件 (UI Components)**：
  * **主標題 Logo**：《車 vs 路人：黑色幽默碰瓷模擬器》動態招牌。
  * **駕駛模式進入鈕 (`btn_driver_mode`)**：顯示當前駕駛最高通關關卡與累積資產，點擊後載入駕駛 Profile 並進入駕駛整備大廳。
  * **路人模式進入鈕 (`btn_pedestrian_mode`)**：顯示當前路人最高通關關卡與詐騙累積金額，點擊後進入路人整備大廳。
  * **危險區域 - 硬性重置鈕 (`btn_hard_reset`)**：點擊跳出二次確認防呆彈窗，確認後調用 `HardReset()` 清空所有本地存檔。


#### 16.2.2 駕駛/路人整備大廳畫面 (`GarageScreen`)
* **駕駛整備大廳元件**：
  * **車輛展示輪播區 (Vehicle Carousel)**：展示當前裝備車輛模型，顯示車輛名稱、重量係數 $W_{vehicle}$、最高時速 $V_{max}$ 與加速度。
  * **車況與強制修復條 (HP & Repair Bar)**：
    * 顯示當前耐久度（如 `75 / 100 HP`）。若 HP $< 50$，HP 條閃爍紅色警告。
    * 提供「全額修復」按鈕，實時計算並標示修復費用 $\text{Cost} = (100 - \text{HP}) \times \text{repairCostPerHp}$。
  * **能力升級卡片區 (Upgrade Cards)**：
    * 「煞車能力 (`brakeLevel`)」、「喇叭威力 (`hornLevel`)」、「法庭辯解 (`defenseArgLevel`)」三大升級按鈕。
    * 顯示當前等級、下級屬性提升數值以及指數升級費用。若玩家資產不足，按鈕呈現 Disable 禁用狀態。
  * **關卡選擇與出擊鈕 (`btn_start_driver_level`)**：點擊觸發 `START_LEVEL_CHECK` 戰前檢查。


* **路人整備大廳元件**：
  * **碰瓷場景地圖 (Level Map)**：展示關卡解鎖進度，標示各場景的准入門檻金額 (`accessMoneyThreshold`) 與目標賠償金額 (`targetMoneyGoal`)。
  * **能力升級卡片區**：「移動速度 (`speedLevel`)」、「假摔閃避 (`dodgeLevel`)」、「索賠辯解 (`defenseArgLevel`)」。
  * **開局鈕 (`btn_start_pedestrian_level`)**：校驗玩家資產是否達到場景准入門檻。


#### 16.2.3 遊戲內 HUD 視圖 (`InGameHUD`)
* **駕駛模式 HUD (`DriverHUD`)**：
  * **3 面獨立後照鏡 Sub-Canvas**：分別渲染左後方、正後方與右後方視角。
  * **擬真儀表板 (Dashboard)**：
    * **數位/針狀時速表**：即時顯示 $V_{impact}$（自動換算顯示為 $\text{km/h}$）。
    * **雙轉向方向燈箭頭**：顯示當前閃爍狀態（`LEFT` / `RIGHT`）。
    * **導航指示板**：顯示距離下個路口剩餘公尺數與轉向箭頭（直走/左轉/右轉）。
  * **操作觸控控鍵 (Mobile Touch Overlay)**：加速踏板 (右下)、煞車踏板 (左下)、喇叭鈕、方向燈切換鈕。


* **路人模式 HUD (`PedestrianHUD`)**：
  * **頂部進度條**：顯示關卡剩餘倒數時間、當前已詐騙金額 / 目標金額進度條、路人當前殘餘 HP 條。
  * **2D 上方俯瞰視角 Canvas**：顯示車道、NPC 車輛動態速度向量與距離預測線。
  * **跳出預備點選取標記 (Spawn Markers)**：點擊地圖上的黃色閃爍標籤選定預備碰瓷位置。
  * **假摔發動按鈕 (`btn_pedestrian_jump`)**：大型紅色高亮按鈕，點擊發送 `PEDESTRIAN_JUMP` 控制指令。


#### 16.2.4 事故責任判決書彈窗 (`VerdictModal`)
* **主要元件**：
  * **紙張質感事故單底圖**：模擬警察與法庭開立之事故責任認定書。
  * **關鍵數據清單**：顯示碰撞瞬間車速 $V_{impact}$、踏入車道時間差 $T_{diff}$ (秒/Ticks)、衝擊能量 $E_{impact}$。
  * **責任比例雙色條 (Fault Ratio Slider)**：
    * 左側紅色條代表駕駛責任比率 ($Fault_{driver} \times 100\%$)。
    * 右側藍色條代表路人責任比率 ($(1 - Fault_{driver}) \times 100\%$)。
    * 若屬於壓線灰色區域，呈現黃色問號與「警局法庭隨機裁決」標籤。
  * **結算金額與傷亡統計**：
    * 顯示路人扣血 $HP_{loss}$ 與車損 $Vehicle_{loss}$。
    * 顯示最終轉移金額：綠色 `+ $XXXX` (獲賠) 或 紅色 `- $XXXX` (支付賠償/罰金)。
  * **動態蓋章動畫**：依據結算結果，於判決書中央重砸印章特效（`GUILTY` 駕駛全責章 / `DISMISSED` 假車禍駁回章）。
  * **確定簽名鈕 (`btn_confirm_verdict`)**：點擊後執行資產扣算並切換畫面。


#### 16.2.5 破產清算彈窗 (`BankruptModal`)
* **主要元件**：
  * **全螢幕灰階濾鏡 (Grayscale Filter)**：凍結背景並轉為黑白。
  * **破產宣告文字**：「資產歸零且無法修復車輛/身體，法院判定強制破產清算！」
  * **大紅印章**：「BANKRUPT / 破產」。
  * **重新開始按鈕 (`btn_restart_hard_reset`)**：點擊觸發 `HardReset()` 並返回標題畫面。


---


### 16.3 畫面遷移邏輯純函數與控制器介面 (Screen Transition Specifications)


為了維護 UI 控制器之可測試性，畫面遷移路徑計算全數封裝為純函數 `resolveNextScreen`：


typescript
// 遊戲所有 UI 畫面列舉
type UIScreenType = 
  | 'TITLE_SCREEN'
  | 'GARAGE_DRIVER'
  | 'GARAGE_PEDESTRIAN'
  | 'IN_GAME_HUD_DRIVER'
  | 'IN_GAME_HUD_PEDESTRIAN'
  | 'VERDICT_MODAL'
  | 'LEVEL_RESULT_MODAL'
  | 'BANKRUPT_MODAL';


// 畫面遷移請求 Payload
interface ScreenTransitionRequest {
  currentScreen: UIScreenType;
  fsmState: GameStateType;
  activeRole: 'DRIVER' | 'PEDESTRIAN';
  hasBankruptTriggered: boolean;
}


/**
 * 純函數：依據 FSM 狀態與角色，計算應呈現之 UI 畫面 (無外部副作用)
 */
function resolveNextScreen(request: ScreenTransitionRequest): UIScreenType {
  // 1. 破產狀態最高優先權
  if (request.hasBankruptTriggered || request.fsmState === 'GAME_OVER_HARD_RESET') {
    return 'BANKRUPT_MODAL';
  }


  // 2. 依據 FSM 狀態進行畫面分流
  switch (request.fsmState) {
    case 'BOOTSTRAP':
    case 'ROLE_SELECT':
      return 'TITLE_SCREEN';


    case 'GARAGE_PREPARATION':
      return request.activeRole === 'DRIVER' ? 'GARAGE_DRIVER' : 'GARAGE_PEDESTRIAN';


    case 'IN_GAME_RUNNING':
    case 'IN_GAME_PAUSED_ACCIDENT':
      return request.activeRole === 'DRIVER' ? 'IN_GAME_HUD_DRIVER' : 'IN_GAME_HUD_PEDESTRIAN';


    case 'VERDICT_POPUP':
      return 'VERDICT_MODAL';


    case 'LEVEL_RESULT':
      return 'LEVEL_RESULT_MODAL';


    default:
      return 'TITLE_SCREEN';
  }
}


// UI 控制器介面
interface IUIController {
  renderScreen(screenType: UIScreenType, dataContext?: unknown): void;
  showModal(modalType: 'VERDICT' | 'BANKRUPT', payload: unknown): void;
  hideModal(): void;
  updateHUD(hudData: unknown): void;
}



# 第 17 章：Canvas 2D 渲染效能與算圖策略 (Canvas Rendering & Performance Optimization)


### 17.1 虛擬解析度與 Letterbox 螢幕自適應 (Fixed Resolution & Scaler)


為保證遊戲在各式螢幕尺寸、高 DPU 手機、平板與 PC 寬螢幕上皆有相同的視野比例與繪圖品質，視圖層實作固定虛擬解析度 **$1280 \times 720$ (16:9)** 與 **Letterbox 自適應縮放技術**。


#### 17.1.1 幾何縮放比例與黑邊偏移公式
給定當前瀏覽器視窗可用寬度 $W_{window}$ 與高度 $H_{window}$：


1. **統一縮放係數 ($S$)**：
   $$S = \min\left(\frac{W_{window}}{1280}, \frac{H_{window}}{720}\right)$$


2. **Letterbox 居中偏移量 ($X_{offset}, Y_{offset}$)**：
   $$X_{offset} = \frac{W_{window} - 1280 \times S}{2}$$
   $$Y_{offset} = \frac{H_{window} - 720 \times S}{2}$$


3. **螢幕點擊座標映射至世界座標**：
   當收到觸動或點擊事件 $(X_{screen}, Y_{screen})$ 時，先轉換為 Canvas 內部的虛擬座標 $(X_{virtual}, Y_{virtual})$：
   $$X_{virtual} = \frac{X_{screen} - X_{offset}}{S}$$
   $$Y_{virtual} = \frac{Y_{screen} - Y_{offset}}{S}$$


---


### 17.2 離屏繪圖與物件池優化 (Offscreen Canvas & Object Pooling)


Canvas 2D Context API 的重繪 (Re-draw) 開銷若過大，易引發幀率失速（Jank）。視圖層採用以下兩大效能優化策略：


#### 17.2.1 靜態背景離屏快取 (Offscreen Canvas Caching)
* **靜態路面與車道**：賽道背景、路面標線、固定建物與變電箱等靜態繪圖元素，於關卡初始化時一次性繪製至獨立的「離屏畫布 (Offscreen Canvas)」。
* **每幀合成 (Composition)**：主渲染迴圈每幀僅呼叫 `ctx.drawImage(offscreenCanvas, ...)` 進行全圖貼圖，將背景 Draw Call 降至 1 次。


#### 17.2.2 粒子與文字特效物件池 (Particle Object Pooling)
碰撞瞬間噴出的車輛碎片、煞車煙霧粒子以及賠償金跳字 (`+$500`) 等頻繁創建與銷毀的物件，**嚴禁於每幀使用 `new` 關鍵字動態配置記憶體**，以防觸發垃圾回收 (GC Pause)。


typescript
/**
 * 通用高效能物件池 (Object Pool)
 */
class ObjectPool<T> {
  private pool: T[] = [];
  private factory: () => T;
  private resetFn: (item: T) => void;


  constructor(factory: () => T, resetFn: (item: T) => void, initialSize: number = 20) {
    this.factory = factory;
    this.resetFn = resetFn;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.factory());
    }
  }


  // 借出物件
  public acquire(): T {
    const item = this.pool.length > 0 ? this.pool.pop()! : this.factory();
    return item;
  }


  // 歸還物件
  public release(item: T): void {
    this.resetFn(item);
    this.pool.push(item);
  }
}



---


### 17.3 視圖相機與平滑跟隨 (Camera Smooth Tracking)


在 2D 俯瞰（路人模式）與車道跟隨（駕駛模式）中，視圖相機 (`Camera2D`) 對目標實體進行線性平滑內插跟隨 (Lerp)，避免鏡頭僵硬抖動。


#### 17.3.1 相機跟隨 Lerp 公式
給定相機當前位置 $Pos_{cam}$、目標車輛位置 $Pos_{target}$ 與平滑係數 $K_{smooth}$ ($0.1 \sim 0.2$)：


$$Pos_{cam, next} = Pos_{cam} + (Pos_{target} - Pos_{cam}) \times K_{smooth}$$


#### 17.3.2 視圖裁剪 (Frustum Culling)
在繪製動態實體前，相機先對實體進行 AABB 視圖邊界檢查：只有中心座標位在畫布邊界外加 $50\text{ px}$ 緩衝區內的實體才執行 `draw()` 動作，其餘實體直接 Skip，大幅降低繪圖 API 呼叫次數。


---


### 17.4 渲染數據快照與純視圖介面 (Render Snapshot Specifications)


為了維護 `src/core/` 純邏輯層與 Canvas 視圖層的完全解耦，核心邏輯層每 Tick 輸出不可變 (Immutable) 的 **渲染數據快照 (`RenderSnapshot`)**，視圖層僅讀取此快照進行繪圖，絕不直接存取實體物件。


typescript
// 渲染快照中的實體繪圖資料包
interface RenderEntityData {
  id: string;
  type: 'VEHICLE' | 'PEDESTRIAN' | 'OBSTACLE_CAT' | 'OIL_SPILL';
  positionPx: { x: number; y: number }; // 已由 (m) 轉換為 (px) 的畫布座標
  rotationRad: number;                  // 旋轉弧度
  widthPx: number;
  heightPx: number;
  spriteKey: string;                    // 素材 Key
  opacity: number;                      // 不透明度 (0.0 ~ 1.0)
  statusBadge?: string;                 // 頭頂狀態 (例: 'STUNNED' 定身, 'INDICATOR_L')
}


// 每幀傳遞給 Renderer 的完整快照
interface RenderSnapshot {
  currentTick: number;
  activeRole: 'DRIVER' | 'PEDESTRIAN';
  viewport: {
    width: number;
    height: number;
    scaleFactor: number;
    offsetX: number;
    offsetY: number;
  };
  cameraPositionPx: { x: number; y: number };
  screenShakeOffsetPx: { x: number; y: number }; // 第 7 章之震動偏移
  entities: RenderEntityData[];
  hudOverlayData: {
    speedKmh: number;
    indicatorState: 'OFF' | 'LEFT' | 'RIGHT';
    remainingSeconds: number;
    targetProgressRatio: number;
  };
}


// Canvas 渲染器標準介面
interface IGameRenderer {
  initialize(canvasElement: HTMLCanvasElement): void;
  resize(windowWidth: number, windowHeight: number): void;
  render(snapshot: RenderSnapshot): void;
  dispose(): void;
}



# 第 18 章：專案打包、構建與 CI/CD 自動化管道 (Build, Deployment & CI/CD Pipeline)


### 18.1 生產環境構建與 Bundle 優化 (Production Build & Bundling Strategies)


本專案採用 **Vite + Rollup** 作為標準構建工具鏈，配合 Vite 內建的高效能 ESM 模組處理解析器。為確保生產環境 (`dist/`) 的靜態資源載入速度最佳化、檔案體積最小化，構建流程遵守以下優化策略：


#### 18.1.1 程式碼分拆 (Code Splitting) 與 Chunking 策略
將應用程式劃分為三大獨立 Chunk，避免單一 `main.js` 過大導致首屏渲染阻塞：
1. **`vendor.js`**：包含外部依賴庫（如 UI 輔助工具、渲染工具等）。
2. **`core.js`**：包含 `src/core/` 100% 純邏輯與遊戲時間/物理引擎。
3. **`ui.js`**：包含 DOM 操作、Canvas 畫布渲染器與音效轉接器。


#### 18.1.2 資源壓縮與 Vite 設定檔 (`vite.config.ts`)


typescript
import { defineConfig } from 'vite';
import path from 'path';


export default defineConfig({
  root: './',
  base: './', // 確保使用相對路徑，相容於 GitHub Pages 與任何 CDN 代管
  build: {
    outDir: 'dist',
    sourcemap: false,            // 生產環境關閉 Sourcemap 以保護原始碼與減少體積
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,      // 生產環境自動移除 console.log
        drop_debugger: true
      }
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            return 'vendor';
          }
          if (id.includes('src/core/')) {
            return 'core';
          }
          if (id.includes('src/ui/') || id.includes('src/adapters/')) {
            return 'ui-adapters';
          }
        },
        entryFileNames: 'assets/js/[name].[hash].js',
        chunkFileNames: 'assets/js/[name].[hash].js',
        assetFileNames: 'assets/[ext]/[name].[hash].[ext]'
      }
    }
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './src/core'),
      '@ui': path.resolve(__dirname, './src/ui'),
      '@adapters': path.resolve(__dirname, './src/adapters')
    }
  }
});



---


### 18.2 CI/CD 自動化管道規格 (GitHub Actions Pipeline Specifications)


專案開發採用 **GitHub Actions** 作為 CI/CD (持續整合 / 持續部署) 自動化管道。任何開展至 Pull Request (PR) 或 Merge 至 `main` 分支的變更，均必須 $100\%$ 自動化通過靜態型別檢查、代碼風格校驗與覆蓋率 100% 的單元測試。


#### 18.2.1 管道四階段驗證流程 (Four-Stage Pipeline)


text
 ┌──────────────────────┐
 │ Stage 1: Lint & Type │ ──► eslint & tsc --noEmit
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ Stage 2: Unit Test   │ ──► vitest run --coverage (要求 Core 100% 覆蓋率)
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ Stage 3: Build       │ ──► vite build
 └──────────┬───────────┘
            │
            ▼
 ┌──────────────────────┐
 │ Stage 4: Deploy      │ ──► 自動部署至 GitHub Pages / Cloudflare Pages
 └──────────────────────┘



#### 18.2.2 GitHub Actions 配置文件 (`.github/workflows/ci-cd.yml`)


yaml
name: CI/CD Pipeline


on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]


jobs:
  validate-and-test:
    name: 靜態檢查與 TDD 單元測試
    runs-on: ubuntu-latest


    steps:
      - name: Checkout 程式碼
        uses: actions/checkout@v4


      - name: 安裝 Node.js 環境
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'


      - name: 安裝專案依賴
        run: npm ci


      - name: 靜態 TypeScript 型別校驗
        run: npx tsc --noEmit


      - name: ESLint 代碼風格檢查
        run: npm run lint


      - name: 執行 Vitest 單元測試與覆蓋率檢查
        run: npm run test:coverage


  build-and-deploy:
    name: 構建生產版本與自動部署
    needs: validate-and-test
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    runs-on: ubuntu-latest


    permissions:
      contents: write


    steps:
      - name: Checkout 程式碼
        uses: actions/checkout@v4


      - name: 安裝 Node.js 環境
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'


      - name: 安裝專案依賴
        run: npm ci


      - name: 執行 Vite 生產構建
        run: npm run build


      - name: 部署至 GitHub Pages
        uses: PeaceIris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
          force_orphan: true



---


### 18.3 漸進式 Web 應用與離線支援 (PWA & Service Worker)


為實現手機與網頁「即開即玩」無縫體驗，且於離線狀態（如地下鐵、隧道）仍可順暢遊玩，專案導入 **PWA (Progressive Web App)** 支援。


#### 18.3.1 Service Worker 快取策略 (`sw.js`)
* **核心檔案快取 (Cache First Strategy)**：`index.html`、打包後的 `js/css` 檔案及靜態音效/圖片檔採用 Cache First 策略，保證第二次開啟遊戲時 $0\text{ms}$ 秒開。
* **版本更新觸發**：當 `GameSaveData.version` 或 Service Worker 版本更新時，自動清理舊版 Cache 緩存，避免玩家載入過期資產。


#### 18.3.2 PWA 清單規格 (`manifest.webmanifest`)


json
{
  "short_name": "車vs路人",
  "name": "車 vs 路人：黑色幽默碰瓷模擬器",
  "icons": [
    {
      "src": "assets/icons/icon-192.png",
      "type": "image/png",
      "sizes": "192x192"
    },
    {
      "src": "assets/icons/icon-512.png",
      "type": "image/png",
      "sizes": "512x512"
    }
  ],
  "start_url": "./index.html",
  "background_color": "#121212",
  "theme_color": "#ff4444",
  "display": "standalone",
  "orientation": "landscape"
}



---


### 18.4 語意化版本號與發行生命週期 (Semantic Versioning & Release Lifecycle)


專案遵循 **語意化版本號 (Semantic Versioning 2.0.0, SemVer)** 規範，版本號格式為 `MAJOR.MINOR.PATCH`（如 `1.2.0`）：


* **MAJOR (主版本號)**：存檔數據結構 (`GameSaveData`) 發生破壞性相容變更（Break Changes），需要提升 `SaveKey` 版本號時。
* **MINOR (次版本號)**：新增關卡、新增車輛、新增隨機事件或新角色能力，且完整向下相容舊版存檔時。
* **PATCH (修訂號)**：修復碰撞引擎邊界 Bug、物理數值微調、UI 樣式與音效問題修復。


#### 發行清單簽核 (Specification Release Sign-off)


| 規格書維度 | 負責模組 | 開發狀態 | 測試覆蓋率目標 | 簽核工程師 |
| :--- | :--- | :--- | :--- | :--- |
| **第 1-3 章** | 核心碰撞與法律判決引擎 (`src/core/judgement/`) | 規格確定 | $100\%$ | Core Team |
| **第 4-6 章** | 有限狀態機與關卡升級 (`src/core/engine/`, `progression/`) | 規格確定 | $100\%$ | Core Team |
| **第 7-11 章**| 影音事件、PRNG、物理與輸入轉譯 (`src/core/`, `adapters/`) | 規格確定 | $100\%$ | Core & Adapter Team |
| **第 12 章** | TDD 極端邊界案例與斷言 (`src/tests/`) | 規格確定 | $100\%$ | QA & Core Team |
| **第 13-15 章**| 本地存儲、工程架構與實體資料庫 (`src/core/storage/`) | 規格確定 | $100\%$ | Architecture Team |
| **第 16-18 章**| UI 畫面、Canvas 2D 效能與 CI/CD 打包管道 (`src/ui/`, `.github/`) | 規格確定 | $100\%$ (Core)/Integration Pass | Frontend & DevOps |


---


# 第 19 章：待釐清問題追蹤 (Open Questions Tracker)

> 本章由 Claude 維護，不屬於原始規格書內容。每輪 TDD 可行性 review 發現的缺口記在此處，
> 使用者回答後由 Claude 更新狀態並同步修正對應章節內文，不另外重寫整份文件。

## 狀態說明
- 🔴 Blocking：擋住對應 MVP 階段第一支測試，不解決無法開工
- 🟡 Needs-Answer：不擋開工，但會影響後續數值/行為正確性
- 🟢 Resolved：已有答案，已回寫進對應章節

## 追蹤清單

### Q19.1 🟢 灰色地帶 (`isAmbiguousZone`) 由誰判定？（2026-07-22 定案）
- **決議**：`calculateCollision` 為 Single Source of Truth，內部依 `timeDiffTicks` 自行歸納 `isAmbiguousZone`
  （`58 <= timeDiffTicks <= 62`），呼叫端不再傳入此欄位。`policeRngValue` 缺值時保底 `Fault_base = 0.5`，
  但 TDD 測試不得依賴保底值斷言。
- **已回寫**：§3.3（判定邏輯）、§3.5（介面移除 input 的 `isAmbiguousZone`，output 新增同名欄位回報）、
  §12.2 / §12.4 / §12.5（測試案例改用 57 / 63 / 60 三組確定性 ticks，60 分別測 `policeRngValue=0.0/0.42`/缺值）。

### Q19.2 🟢 煞車減傷/減速公式（2026-07-22 定案）
- **決議**：鎖定乘數公式 $a = -a_{brake} \times (1 + (\text{brakeLevel}-1) \times 0.05)$，Level 1 為 $1.0\times$ 基準，Level 10 為 $1.45\times$。
- **已回寫**：§5.1、§9.4（含「加速煞車同時按住」分支，先前遺漏套用煞車加成，一併補上）。§9.5 程式碼原本即為此版本，不需再動。

### Q19.3 🟢 煞車失靈機率常數（2026-07-22 定案）
- **決議**：以 §8.3.3 為權威 $p_{sec} = 0.01 \times (N-1)$，Level 1 恆為 0。
- **已回寫**：§6.4 `generateLevelConfig` 的 `aiBrakeFailureProbability` 改為 `0.01 * (safeLevel - 1)`。

### Q19.4 🟢 路人准入門檻扣款懲罰（2026-07-22 定案）
- **決議**：確認刻意拿掉，v2 起資產不足僅阻擋進入 (`canAccess: false`)，不再額外扣 5% 資產。
- **已回寫**：無需修改程式碼（§6.4 `validateLevelAccess` 現狀即為最終行為），僅在此記錄決議來源以免日後被誤判為遺漏。

### Q19.5 🟢 `policeRngValue` 缺值行為（2026-07-22 定案，與 Q19.1 合併回覆）
- **決議**：`isAmbiguousZone === true` 且未傳入時，函數內部保底 `Fault_base = 0.5`；TDD 測試必須明確傳入該值才能斷言，不可依賴保底。
- **已回寫**：§3.3、§3.5、§12.5 邊界 3b。

---

# 第 20 章：MVP2 待釐清問題（GameFSM & Save System）

> Q19 系列（MVP1）已全數解決並回寫進對應章節。以下是針對 MVP2 範疇（§2.4.2、§4、§13）的第二輪缺口，
> 狀態說明同第 19 章。

### Q20.1 🟢 `GameStateType` 從未正式定義為列舉（2026-07-22 定案）
- **決議**：確認 8 個狀態為完整官方清單。
- **已回寫**：§4.3.1 新增 `GameStateType` 型別宣告。

### Q20.2 🟢 沒有「狀態 × 合法指令」轉移矩陣（2026-07-22 定案）
- **決議**：非法轉移一律拋出 `InvalidStateTransitionError`；提供 12 條合法轉移的完整矩陣。
- **已回寫**：§4.3.2 新增轉移矩陣表與例外處理規則。

### Q20.3 🟢 `PreGameCheck` 命名與型別（2026-07-22 定案，含二次校正）
- **決議**：函數名稱統一為 `validatePreGameAccess`；`RepairCostConfig`/`PreGameAccessInput`/`PreGameAccessResult` 三個 interface 定案。
- **二次校正**：`repairedHp` 觸發時固定為 **50**（原答案「100」為文字誤植），與 `GarageScreen` 手動全額修復（100）是兩套不同機制。
- **已回寫**：§4.2 純函數介面 signature 與二次定案註記。

### Q20.4 🟢 `WRONG_TURN` 是否對應獨立 FSM 狀態（2026-07-22 定案）
- **決議**：不建立獨立狀態，維持在 `IN_GAME_RUNNING` 內部處理，不進入轉移矩陣。
- **已回寫**：§4.3.3。

### Q20.5 🟢 `SaveManager` 與 `GameFSM` 解耦機制（2026-07-22 定案）
- **決議**：觀察者模式，`GameFSM.onStateChange()` 廣播，實際存檔呼叫由 `src/core/` 之外的協調層負責。
- **已回寫**：§4.3.4。

### Q20.6 🟢 `HardReset()` 純函數拆分（2026-07-22 定案）
- **決議**：拆成 `computeHardResetState()`（純函數，`src/core/progression/saveModel.ts`）+ `executeHardReset()`（I/O 協調函數，`src/adapters/`）。
- **已回寫**：§5.3 第 3 小節新增兩個函數 signature。

### Q20.7 🟢 `WebLocalStorageAdapter` 目錄歸屬（2026-07-22 定案）
- **決議**：`IStorageAdapter`/`MemoryStorageAdapter` 留在 `src/core/storage/`；`WebLocalStorageAdapter` 移至 `src/adapters/`。
- **已回寫**：§13.5 新增檔案歸屬說明與程式碼註解。

---

# 第 21 章：MVP3 待釐清問題（Tick Engine & Random Events）

> 針對 MVP3 範疇（§8、§9、§10）的第三輪缺口。狀態說明同第 19 章。

### Q21.1 🟢 `GameContext` 補齊 `isBraking`（2026-07-22 定案）
- **決議**：`GameContext` 正式改為 `{ currentLevelId, vehicleSpeedKmh, isBraking, isHornPressed, pedestrianDistanceMeter }`。
- **注意**：速度欄位改為 `vehicleSpeedKmh`（km/h），故 `STRAY_CAT_CROSSING` 觸發條件由「> 5.556 m/s」等價改寫為「`vehicleSpeedKmh > 20`」。

### Q21.2 🟢 主動/被動事件路徑分離（2026-07-22 定案）
- **決議**：`processRandomEvents` 只處理被動機率事件（貓咪、煞車失靈）；`HORN_STUN_EFFECT` 移出為主動機制，由 `HornSystem` 100% 確定性觸發。
- **已實作**：`src/core/events/hornSystem.ts`（`resolveHornStun` 純函數）+ 8 個測試。

### Q21.3 🟢 貓咪去重靠 Manager（2026-07-22 定案）
- **決議**：採 `RandomEventManager` 內部 `isAlreadyActive` 去重，不污染 `GameContext`。

### Q21.4 🟢 `TickEngine` 純計數 + Callback（2026-07-22 定案）
- **決議**：採「固定步長計數器 + `onTick` 訂閱」，`step()` 推進並回傳 tick，不耦合物理/事件。
- **已實作**：`src/core/engine/TickEngine.ts` + 7 個測試。

---

## MVP3 剩餘接縫（Q21.5~Q21.7）——`RandomEventManager` 開工前的最後對齊

> Q21.1 定案後的新 `GameContext`（5 欄位）與 §8.4 既有 `processRandomEvents` 參考程式碼之間有三處對不上，需先對齊才能寫 Manager。

### Q21.5 🔴 `processRandomEvents` 需要的 `rng` 與 `currentTick` 已從 `GameContext` 移除
- 新版 `GameContext`（Q21.1）不含 `rng` 與 `currentTick`，但 §8.4 的 `processRandomEvents` 內部用到 `context.rng.nextBool(...)` 與 `context.currentTick`。
- **建議**：把 `rng: SeededRNG` 與 `currentTick: number` 當成 `processRandomEvents` 的**顯式參數**傳入（`processRandomEvents(context, currentTick, rng, activeEvents, registeredEvents)`），保持 `GameContext` 為乾淨的「世界快照」。請確認或改指定放回 `GameContext`。

### Q21.6 🔴 `BRAKE_FAILURE_EVENT` 的機率是關卡動態值，但 `IRandomEvent.baseProbabilityPerSecond` 是固定欄位
- §8.3.3 煞車失靈機率為 `p_sec = 0.01 × (N-1)`，隨 `currentLevelId` 變動；但 §8.3.1 `IRandomEvent` 只有固定的 `baseProbabilityPerSecond` 欄位，§8.4 迴圈也是讀這個固定值。
- **建議**：`IRandomEvent` 新增方法 `getProbabilityPerSecond(context): number`（預設回傳 `baseProbabilityPerSecond`，煞車失靈事件 override 成 `0.01*(currentLevelId-1)`），`processRandomEvents` 改呼叫此方法而非直接讀欄位。請確認或提供其他做法。

### Q21.7 🟡 `EventEffect.spawnEntities: IGameEntity[]` 對純核心層過重
- §8.3.1 `EventEffect.spawnEntities` 型別是 `IGameEntity[]`，但 `IGameEntity`（§6.3）帶有 `onCollision`/`onTick` 等執行期行為，偏 runtime/UI，放進純事件效果結果裡會讓 `src/core/events/` 依賴較重的實體介面。
- **建議**：核心層改用輕量生成描述子（如 `{ type: 'STRAY_CAT'; spawnDistanceMeter: number }[]`），由上層 runtime 再實體化成 `IGameEntity`。請確認或維持原 `IGameEntity[]`。

---

# 第 22 章：MVP4 待釐清問題（UI 整合與 Playable Level 1）

> 針對 MVP4 範疇（§11 輸入、§16 UI 流程、§17 Canvas）的第四輪缺口。狀態說明同第 19 章。

### Q22.1 🟢 輸入網域二分 + 命名統一（2026-07-22 定案）
- **決議**：§16.2.2 按鈕動作統一為 `START_LEVEL`；`FSMAction` 僅由 UI 點擊發射至 `GameFSM`，`InputCommand` 僅在 `IN_GAME_RUNNING` 時由 `InputAdapter` 派發至局內模擬器。

### Q22.2 🟡 `GameController` 黏合層（2026-07-22 定案，但提供的程式碼與既有實作有 3 處衝突，見 Q22.5）
- **決議**：於 `src/core/engine/GameController.ts` 建立 Headless Orchestrator。
- **⚠️ 尚未實作**：定案提供的範例程式碼與 MVP1/MVP2 已驗收的既有程式有 3 處對不上，照抄會編譯失敗，須先修正（見 Q22.5）。

### Q22.3 🟢 `resolveNextScreen` 砍掉 `hasBankruptTriggered`（2026-07-22 定案）
- **決議**：以 `fsmState === 'GAME_OVER_HARD_RESET'` 為破產唯一真相來源（SSOT），移除 `hasBankruptTriggered`。
- **已實作**：`src/core/engine/screenResolver.ts`（見 Q22.6 目錄決策）+ 8 個測試。

### Q22.4 🟢 採納 `LevelSimulator` 局內模擬器（2026-07-22 定案）
- **決議**：於 `src/core/engine/LevelSimulator.ts` 集中 `entryTick` 記錄、位移與 AABB 檢測。
- **⚠️ 尚未實作**：定案提供的 `LevelSimulator` 骨架只有 `triggerPedestrianJump`/`getEntryTick`/`reset`，尚缺「吃 input+tick 吐新 runtime state」的推進主體與 AABB 串接，屬骨架非完整規格，待 Q22.5 一併釐清後實作。

---

## MVP4 開工前的實作衝突（Q22.5~Q22.6）——照抄定案程式碼會壞掉，須先對齊

### Q22.5 🔴 定案的 `GameController` 範例程式碼與既有已驗收程式有 3 處不相容
1. **FSM 方法名**：範例呼叫 `this.fsm.transition('START_LEVEL')`，但既有 `GameFSM`（已驗收）的方法叫 **`dispatch()`**，沒有 `transition()`。→ 請統一：改範例用 `dispatch`，或替 `GameFSM` 增設 `transition` 別名。建議前者。
2. **碰撞回傳型別名**：範例 import `CalculateCollisionResult`，但既有 `collisionEngine.ts` 匯出的是 **`CalculateCollisionOutput`**（已驗收、已被 §3.5 與測試使用）。→ 請統一沿用 `CalculateCollisionOutput`。
3. **`handleCollision` 流程順序**：範例先 `dispatch('COLLISION_OCCURRED')`（→ `IN_GAME_PAUSED_ACCIDENT`）再直接 `dispatch('SHOW_VERDICT')`（→ `VERDICT_POPUP`），中間沒有停留讓「物理凍結 50ms」發生。若這是刻意的同步簡化可接受，但請確認 `handleCollision` 是否本就該一次跨兩個狀態，還是 `SHOW_VERDICT` 應由 TickEngine 在凍結結束後才觸發。
- **待答**：確認上述 3 點的修正方式，我再實作 `GameController`。

### Q22.5 🟢 已定案並修正（2026-07-22）
- `dispatch()`、`CalculateCollisionOutput` 命名對齊；`handleCollision` 只 `dispatch('COLLISION_OCCURRED')`，
  `SHOW_VERDICT` 由 TickEngine 物理凍結（50ms/3 Ticks）後非同步觸發。
- **已實作**：`src/core/engine/GameController.ts` + 11 個測試（含 E2E 主流程）。

### Q22.6 🟢 已定案（2026-07-22）：`screenResolver.ts` 維持 `src/core/engine/`
- 採納 Claude 建議，保持 core 不反向依賴 ui。已實作於 `src/core/engine/screenResolver.ts`。

---

# 第 23 章：全域 spec 掃描發現（第五輪，非 MVP 特定）

> 掃描 §6、§7、§13、§15、§17 尚未實作的純函數區塊後的發現。狀態說明同第 19 章。

### Q21.8 🟢 `IRandomEvent` 效果模型與 `durationTicks` 補齊（2026-07-23 定案）
- **決議**：`IRandomEvent` 補回 `durationTicks?`；新增 `ActiveEventEffect { eventId, remainingTicks, brakeMultiplier?, speedMultiplier? }`；
  `onTrigger` 回傳 `ActiveEventEffect | void`；`RandomEventManager` 維護 `activeEffects[]`，每 Tick 遞減 `remainingTicks`、到期自動清除。
- **已實作**：`src/core/events/randomEvents.ts`（貓咪 120t、煞車失靈 90t+brakeMultiplier 0）、
  `src/core/events/RandomEventManager.ts`（觸發/去重/合併乘數/到期）+ 13 個測試（含 90t 到期、乘數疊加、可重現性）。
- **註記**：貓咪的「實體生成」目前 `ActiveEventEffect` 無 spawn 欄位表達，僅以 `remainingTicks` 標記存活期，實體由上層 runtime 依 `triggeredEventIds` 生成——若之後要在 core 表達 spawn，需再加 `spawnDescriptors`（延伸模組 EX-A1 相關）。

### Q23.1 🟢 `validateAndMigrateSaveData` 注入時間戳（2026-07-23 定案並實作）
- **決議/已實作**：`validateAndMigrateSaveData(rawData, currentTimestamp)`，`src/core/progression/saveModel.ts`，core 無 `Date.now()`。+ 11 個測試。

### Q23.2 🟢 `SeededRNG.nextEntityId` 決定性實體 id（2026-07-23 定案並實作）
- **決議/已實作**：`nextEntityId(prefix='ent')` 用 `nextFloat` 產生決定性 hex id，取代 `Math.random()`。+ 4 個測試。

### Q24.1 🟢 Part 3 玩法手冊矛盾（2026-07-23 已由使用者勘誤）
- **決議**：Part 3 §3 更正為「黃金碰瓷點 = T_diff > 62 ticks（瞄準 63~68 ticks，兼顧駕駛全責與高衝擊能量）」。
- README/§2.2.3 本即正確版，無需再改；玩法手冊以 §3.3 為準。

### Q23.3 🟢 以下純函數規格完整、無歧義，隨時可依既有 TDD 流程實作（非缺口，待你點頭即開工）
- §6.4 `generateLevelConfig(levelId)`、`validateLevelAccess(role, money, config)`（難度遞增數值模型 §6.2 已含 aiBrakeFailureProbability 修正）
- §7.4 `calculateScreenShakeOffset(state, rngValue)`（RNG 由外注入，純函數）
- §15.5 `sanitizeVehicleConfig(raw)`、`clampEntityStat(value, min, max)`
- §5.4 `calculateUpgradeCost(level, baseCost)`、`processStatUpgrade(request)`（養成升級費用，指數曲線）
- §17.1 letterbox 縮放/座標映射、§17.3 相機 Lerp——屬渲染層數學，可放 core 或 ui，待目錄決策

---