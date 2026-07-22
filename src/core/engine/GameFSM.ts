// §4.3 GameFSM 狀態機 (Q20.1 GameStateType、Q20.2 轉移矩陣、Q20.5 onStateChange 觀察者介面)

export type GameStateType =
  | 'BOOTSTRAP'
  | 'ROLE_SELECT'
  | 'GARAGE_PREPARATION'
  | 'IN_GAME_RUNNING'
  | 'IN_GAME_PAUSED_ACCIDENT'
  | 'VERDICT_POPUP'
  | 'LEVEL_RESULT'
  | 'GAME_OVER_HARD_RESET';

export type FSMAction =
  | 'INIT_COMPLETE'
  | 'SELECT_ROLE'
  | 'START_LEVEL'
  | 'SWITCH_ROLE'
  | 'TRIGGER_BANKRUPT'
  | 'COLLISION_OCCURRED'
  | 'LEVEL_CLEAR'
  | 'SHOW_VERDICT'
  | 'CONFIRM_VERDICT'
  | 'RETURN_TO_GARAGE'
  | 'EXECUTE_HARD_RESET';

export class InvalidStateTransitionError extends Error {
  constructor(public readonly fromState: GameStateType, public readonly action: FSMAction) {
    super(`Invalid FSM transition: action "${action}" is not allowed from state "${fromState}"`);
    this.name = 'InvalidStateTransitionError';
  }
}

// §4.3.2 狀態轉移矩陣：key 為 `${fromState}::${action}`
const TRANSITION_TABLE: Partial<Record<string, GameStateType>> = {
  'BOOTSTRAP::INIT_COMPLETE': 'ROLE_SELECT',
  'ROLE_SELECT::SELECT_ROLE': 'GARAGE_PREPARATION',
  'GARAGE_PREPARATION::START_LEVEL': 'IN_GAME_RUNNING',
  'GARAGE_PREPARATION::SWITCH_ROLE': 'ROLE_SELECT',
  'GARAGE_PREPARATION::TRIGGER_BANKRUPT': 'GAME_OVER_HARD_RESET',
  'IN_GAME_RUNNING::COLLISION_OCCURRED': 'IN_GAME_PAUSED_ACCIDENT',
  'IN_GAME_RUNNING::LEVEL_CLEAR': 'LEVEL_RESULT',
  'IN_GAME_PAUSED_ACCIDENT::SHOW_VERDICT': 'VERDICT_POPUP',
  'VERDICT_POPUP::CONFIRM_VERDICT': 'GARAGE_PREPARATION',
  'VERDICT_POPUP::TRIGGER_BANKRUPT': 'GAME_OVER_HARD_RESET',
  'LEVEL_RESULT::RETURN_TO_GARAGE': 'GARAGE_PREPARATION',
  'GAME_OVER_HARD_RESET::EXECUTE_HARD_RESET': 'ROLE_SELECT'
};

type StateChangeListener = (from: GameStateType, to: GameStateType) => void;

export class GameFSM {
  private currentState: GameStateType;
  private listeners: StateChangeListener[] = [];

  constructor(initialState: GameStateType = 'BOOTSTRAP') {
    this.currentState = initialState;
  }

  getCurrentState(): GameStateType {
    return this.currentState;
  }

  dispatch(action: FSMAction): GameStateType {
    const nextState = TRANSITION_TABLE[`${this.currentState}::${action}`];
    if (!nextState) {
      throw new InvalidStateTransitionError(this.currentState, action);
    }

    const previousState = this.currentState;
    this.currentState = nextState;
    for (const listener of this.listeners) {
      listener(previousState, nextState);
    }
    return nextState;
  }

  onStateChange(callback: StateChangeListener): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((listener) => listener !== callback);
    };
  }
}
