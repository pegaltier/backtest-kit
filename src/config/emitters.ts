import { Subject } from "functools-kit";
import { IStrategyTickResult } from "../interfaces/Strategy.interface";

/**
 * Global signal emitter for all trading events (live + backtest).
 * Emits all signal events regardless of execution mode.
 */
export const signalEmitter = new Subject<IStrategyTickResult>();

/**
 * Live trading signal emitter.
 * Emits only signals from live trading execution.
 */
export const signalLiveEmitter = new Subject<IStrategyTickResult>();

/**
 * Backtest signal emitter.
 * Emits only signals from backtest execution.
 */
export const signalBacktestEmitter = new Subject<IStrategyTickResult>();

