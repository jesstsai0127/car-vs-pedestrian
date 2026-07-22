// §10.4 導航與方向燈校驗純函數

export type TurnDirection = 'STRAIGHT' | 'TURN_LEFT' | 'TURN_RIGHT';
export type IndicatorState = 'OFF' | 'LEFT' | 'RIGHT';

export interface TurnCheckResult {
  isCorrect: boolean;
  failedReason?: string;
}

export interface NavigationProcessResult {
  isCorrect: boolean;
  nextRetryCount: number;
  nextLevelId: number;
  shouldRestartLevel: boolean;
  isDowngraded: boolean;
}

/**
 * 純函數：校驗駕駛方向燈是否符合路口指示 (§10.4)
 */
export function checkTurnSignalCorrectness(
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
 * 純函數：處理轉錯方向後的重試計數與降關計算 (§10.3, §10.4)
 */
export function processTurnError(
  currentRetryCount: number,
  currentLevelId: number
): NavigationProcessResult {
  const nextRetry = currentRetryCount + 1;

  if (nextRetry >= 3) {
    const downgradedLevel = Math.max(1, currentLevelId - 1);
    return {
      isCorrect: false,
      nextRetryCount: 0,
      nextLevelId: downgradedLevel,
      shouldRestartLevel: true,
      isDowngraded: true
    };
  }

  return {
    isCorrect: false,
    nextRetryCount: nextRetry,
    nextLevelId: currentLevelId,
    shouldRestartLevel: true,
    isDowngraded: false
  };
}
