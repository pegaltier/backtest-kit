import backtest from "../lib";
import { signalEmitter, signalLiveEmitter, signalBacktestEmitter, errorEmitter } from "../config/emitters";
import { IStrategyTickResult } from "../interfaces/Strategy.interface";
import { queued } from "functools-kit";

const LISTEN_SIGNAL_METHOD_NAME = "event.listenSignal";
const LISTEN_SIGNAL_ONCE_METHOD_NAME = "event.listenSignalOnce";
const LISTEN_SIGNAL_LIVE_METHOD_NAME = "event.listenSignalLive";
const LISTEN_SIGNAL_LIVE_ONCE_METHOD_NAME = "event.listenSignalLiveOnce";
const LISTEN_SIGNAL_BACKTEST_METHOD_NAME = "event.listenSignalBacktest";
const LISTEN_SIGNAL_BACKTEST_ONCE_METHOD_NAME = "event.listenSignalBacktestOnce";
const LISTEN_ERROR_METHOD_NAME = "event.listenError";

/**
 * Subscribes to all signal events with queued async processing.
 *
 * Events are processed sequentially in order received, even if callback is async.
 * Uses queued wrapper to prevent concurrent execution of the callback.
 *
 * @param fn - Callback function to handle signal events (idle, opened, active, closed)
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```typescript
 * import { listenSignal } from "./function/event";
 *
 * const unsubscribe = listenSignal((event) => {
 *   if (event.action === "opened") {
 *     console.log("New signal opened:", event.signal);
 *   } else if (event.action === "closed") {
 *     console.log("Signal closed with PNL:", event.pnl.pnlPercentage);
 *   }
 * });
 *
 * // Later: stop listening
 * unsubscribe();
 * ```
 */
export function listenSignal(fn: (event: IStrategyTickResult) => void) {
  backtest.loggerService.log(LISTEN_SIGNAL_METHOD_NAME);
  return signalEmitter.subscribe(queued(async (event) => fn(event)));
}

/**
 * Subscribes to filtered signal events with one-time execution.
 *
 * Listens for events matching the filter predicate, then executes callback once
 * and automatically unsubscribes. Useful for waiting for specific signal conditions.
 *
 * @param filterFn - Predicate to filter which events trigger the callback
 * @param fn - Callback function to handle the filtered event (called only once)
 * @returns Unsubscribe function to cancel the listener before it fires
 *
 * @example
 * ```typescript
 * import { listenSignalOnce } from "./function/event";
 *
 * // Wait for first take profit hit
 * listenSignalOnce(
 *   (event) => event.action === "closed" && event.closeReason === "take_profit",
 *   (event) => {
 *     console.log("Take profit hit! PNL:", event.pnl.pnlPercentage);
 *   }
 * );
 *
 * // Wait for any signal to close on BTCUSDT
 * const cancel = listenSignalOnce(
 *   (event) => event.action === "closed" && event.signal.symbol === "BTCUSDT",
 *   (event) => console.log("BTCUSDT signal closed")
 * );
 *
 * // Cancel if needed before event fires
 * cancel();
 * ```
 */
export function listenSignalOnce(
  filterFn: (event: IStrategyTickResult) => boolean,
  fn: (event: IStrategyTickResult) => void
) {
  backtest.loggerService.log(LISTEN_SIGNAL_ONCE_METHOD_NAME);
  return signalEmitter.filter(filterFn).once(fn);
}

/**
 * Subscribes to live trading signal events with queued async processing.
 *
 * Only receives events from Live.run() execution.
 * Events are processed sequentially in order received.
 *
 * @param fn - Callback function to handle live signal events
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```typescript
 * import { listenSignalLive } from "./function/event";
 *
 * const unsubscribe = listenSignalLive((event) => {
 *   if (event.action === "closed") {
 *     console.log("Live signal closed:", event.pnl.pnlPercentage);
 *   }
 * });
 * ```
 */
export function listenSignalLive(fn: (event: IStrategyTickResult) => void) {
  backtest.loggerService.log(LISTEN_SIGNAL_LIVE_METHOD_NAME);
  return signalLiveEmitter.subscribe(queued(async (event) => fn(event)));
}

/**
 * Subscribes to filtered live signal events with one-time execution.
 *
 * Only receives events from Live.run() execution.
 * Executes callback once and automatically unsubscribes.
 *
 * @param filterFn - Predicate to filter which events trigger the callback
 * @param fn - Callback function to handle the filtered event (called only once)
 * @returns Unsubscribe function to cancel the listener before it fires
 *
 * @example
 * ```typescript
 * import { listenSignalLiveOnce } from "./function/event";
 *
 * // Wait for first live take profit hit
 * listenSignalLiveOnce(
 *   (event) => event.action === "closed" && event.closeReason === "take_profit",
 *   (event) => console.log("Live take profit:", event.pnl.pnlPercentage)
 * );
 * ```
 */
export function listenSignalLiveOnce(
  filterFn: (event: IStrategyTickResult) => boolean,
  fn: (event: IStrategyTickResult) => void
) {
  backtest.loggerService.log(LISTEN_SIGNAL_LIVE_ONCE_METHOD_NAME);
  return signalLiveEmitter.filter(filterFn).once(fn);
}

/**
 * Subscribes to backtest signal events with queued async processing.
 *
 * Only receives events from Backtest.run() execution.
 * Events are processed sequentially in order received.
 *
 * @param fn - Callback function to handle backtest signal events
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```typescript
 * import { listenSignalBacktest } from "./function/event";
 *
 * const unsubscribe = listenSignalBacktest((event) => {
 *   if (event.action === "closed") {
 *     console.log("Backtest signal closed:", event.pnl.pnlPercentage);
 *   }
 * });
 * ```
 */
export function listenSignalBacktest(fn: (event: IStrategyTickResult) => void) {
  backtest.loggerService.log(LISTEN_SIGNAL_BACKTEST_METHOD_NAME);
  return signalBacktestEmitter.subscribe(queued(async (event) => fn(event)));
}

/**
 * Subscribes to filtered backtest signal events with one-time execution.
 *
 * Only receives events from Backtest.run() execution.
 * Executes callback once and automatically unsubscribes.
 *
 * @param filterFn - Predicate to filter which events trigger the callback
 * @param fn - Callback function to handle the filtered event (called only once)
 * @returns Unsubscribe function to cancel the listener before it fires
 *
 * @example
 * ```typescript
 * import { listenSignalBacktestOnce } from "./function/event";
 *
 * // Wait for first backtest stop loss hit
 * listenSignalBacktestOnce(
 *   (event) => event.action === "closed" && event.closeReason === "stop_loss",
 *   (event) => console.log("Backtest stop loss:", event.pnl.pnlPercentage)
 * );
 * ```
 */
export function listenSignalBacktestOnce(
  filterFn: (event: IStrategyTickResult) => boolean,
  fn: (event: IStrategyTickResult) => void
) {
  backtest.loggerService.log(LISTEN_SIGNAL_BACKTEST_ONCE_METHOD_NAME);
  return signalBacktestEmitter.filter(filterFn).once(fn);
}

/**
 * Subscribes to background execution errors with queued async processing.
 *
 * Listens to errors caught in Live.background() and Backtest.background() execution.
 * Events are processed sequentially in order received, even if callback is async.
 * Uses queued wrapper to prevent concurrent execution of the callback.
 *
 * @param fn - Callback function to handle error events
 * @returns Unsubscribe function to stop listening
 *
 * @example
 * ```typescript
 * import { listenError } from "./function/event";
 *
 * const unsubscribe = listenError((error) => {
 *   console.error("Background execution error:", error.message);
 *   // Log to monitoring service, send alerts, etc.
 * });
 *
 * // Later: stop listening
 * unsubscribe();
 * ```
 */
export function listenError(fn: (error: Error) => void) {
  backtest.loggerService.log(LISTEN_ERROR_METHOD_NAME);
  return errorEmitter.subscribe(queued(async (error) => fn(error)));
}
