// §13.5：IStorageAdapter 抽象介面 + 測試用 MemoryStorageAdapter
// WebLocalStorageAdapter（會存取 window.localStorage）依 Q20.7 定案歸屬 src/adapters/，不放在這裡

export interface IStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  clear(): void;
}

export class MemoryStorageAdapter implements IStorageAdapter {
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
