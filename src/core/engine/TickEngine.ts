// §9.1 / Q21.4 定案：固定時間步長計數器 + Callback 訂閱，與物理/事件/FSM 完全解耦

export type TickCallback = (currentTick: number, deltaSec: number) => void;

export class TickEngine {
  private currentTick = 0;
  private readonly deltaSec = 1 / 60; // 0.016667s
  private listeners: TickCallback[] = [];

  /**
   * 註冊每 Tick 回調（物理、事件、FSM 訂閱此處）
   */
  onTick(callback: TickCallback): void {
    this.listeners.push(callback);
  }

  /**
   * 推進單一 Tick，回傳當前最新 Tick 數
   */
  step(): number {
    this.currentTick++;
    for (const listener of this.listeners) {
      listener(this.currentTick, this.deltaSec);
    }
    return this.currentTick;
  }

  getCurrentTick(): number {
    return this.currentTick;
  }

  reset(): void {
    this.currentTick = 0;
  }
}
