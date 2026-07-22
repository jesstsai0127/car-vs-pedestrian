// §8.1 Mulberry32 可重現偽隨機數產生器

export class SeededRNG {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0; // 強制轉為無符號 32 位元整數
  }

  /**
   * 取得 0.0 (含) 至 1.0 (不含) 之間的浮點數
   */
  nextFloat(): number {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /**
   * 取得閉區間 [min, max] 內的整數亂數
   */
  nextInt(min: number, max: number): number {
    const minCeil = Math.ceil(min);
    const maxFloor = Math.floor(max);
    return minCeil + Math.floor(this.nextFloat() * (maxFloor - minCeil + 1));
  }

  /**
   * 依據指定機率回傳布林值
   */
  nextBool(probability: number): boolean {
    return this.nextFloat() < probability;
  }

  /**
   * 取得當前內部狀態（供存檔與狀態快照備份）
   */
  getState(): number {
    return this.state;
  }
}
