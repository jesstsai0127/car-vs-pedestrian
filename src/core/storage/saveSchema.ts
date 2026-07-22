// 存檔 Schema 型別定義 (§13.2) 與預設初始狀態常數 (§13.3)

export interface LevelRecord {
  isPassed: boolean;
  bestTimeSeconds?: number;
  totalPayoutPaid?: number;
  maxSinglePayout?: number;
  playCount: number;
}

export interface DriverProfile {
  currentLevel: number;
  money: number;
  vehicleHp: number;
  selectedVehicleId: string;
  unlockedVehicleIds: string[];
  stats: {
    brakeLevel: number;
    hornLevel: number;
    defenseArgLevel: number;
  };
  levelRecords: Record<number, LevelRecord>;
}

export interface PedestrianProfile {
  currentLevel: number;
  money: number;
  hp: number;
  stats: {
    speedLevel: number;
    dodgeLevel: number;
    defenseArgLevel: number;
  };
  levelRecords: Record<number, LevelRecord>;
}

export interface GameSaveData {
  version: string;
  lastSavedTimestamp: number;
  activeRole: 'DRIVER' | 'PEDESTRIAN';
  driver: DriverProfile;
  pedestrian: PedestrianProfile;
}

export const INITIAL_GAME_SAVE: Readonly<GameSaveData> = Object.freeze({
  version: '1.0.0',
  lastSavedTimestamp: 0,
  activeRole: 'DRIVER',

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
    levelRecords: {
      1: {
        isPassed: false,
        playCount: 0
      }
    }
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
    levelRecords: {
      1: {
        isPassed: false,
        playCount: 0
      }
    }
  }
});
