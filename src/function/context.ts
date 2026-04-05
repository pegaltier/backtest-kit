import backtest from "../lib";
import {
  MethodContextService,
  IMethodContext,
} from "../lib/services/context/MethodContextService";
import {
  ExecutionContextService,
  IExecutionContext,
} from "../lib/services/context/ExecutionContextService";

import beginContext from "../utils/beginContext";
import alignToInterval from "../utils/alignToInterval";

const RUN_IN_MOCK_CONTEXT_METHOD_NAME = "context.runInMockContext";

/**
 * Full context required to run a function inside both method and execution scopes.
 *
 * Combines `IMethodContext` (schema routing: exchange, strategy, frame names) with
 * `IExecutionContext` (runtime state: symbol, timestamp, backtest flag).
 *
 * Passed as a single object to `runInContextInternal`, which splits and distributes
 * the fields between `MethodContextService` and `ExecutionContextService`.
 */
interface IRunContext extends IMethodContext, IExecutionContext {}

/**
 * A zero-argument function that may be synchronous or asynchronous.
 *
 * @template T - Return type of the function.
 */
type Function<T extends unknown = any> = () => T | Promise<T>;

/**
 * Typed signature of the context-aware runner produced by wrapping
 * `runInContextInternal` with `beginContext`.
 *
 * Accepts a zero-argument function and a full `IRunContext`, executes the
 * function inside both `MethodContextService` and `ExecutionContextService`
 * scopes, and returns a promise of its result.
 *
 * @template T - Return type of `run`.
 */
type Runner = <T extends unknown = any>(
  run: Function<T>,
  context: IRunContext,
) => Promise<T>;

/**
 * Internal runner that executes `run` inside nested `MethodContextService` and
 * `ExecutionContextService` scopes established from the given `context`.
 *
 * Wrapped with `beginContext` so any inherited outer context is escaped first,
 * ensuring the scopes set here are the only ones visible to `run`.
 *
 * Not exported — use `runInMockContext` for external callers.
 */
const runInContextInternal = beginContext(
  async <T extends unknown = any>(run: Function<T>, context: IRunContext) => {
    return await MethodContextService.runInContext(
      async () => {
        return await ExecutionContextService.runInContext(
          async () => {
            return await run();
          },
          {
            backtest: context.backtest,
            symbol: context.symbol,
            when: context.when,
          },
        );
      },
      {
        exchangeName: context.exchangeName,
        strategyName: context.strategyName,
        frameName: context.frameName,
      },
    );
  },
) as Runner;

/**
 * Runs a function inside a mock method and execution context.
 *
 * Useful in tests and scripts that need to call context-dependent services
 * (e.g. `getBacktestTimeframe`) without a real backtest runner.
 *
 * All context fields are optional; the defaults produce a minimal live-mode
 * environment pointing at placeholder schema names:
 * - `exchangeName` → `"mock-exchange"`
 * - `strategyName` → `"mock-strategy"`
 * - `frameName`    → `"mock-frame"`
 * - `symbol`       → `"BTCUSDT"`
 * - `backtest`     → `false` (live mode)
 * - `when`         → current minute boundary (`alignToInterval(new Date(), "1m")`)
 *
 * @param run - Zero-argument function to execute within the context.
 * @param context - Partial `IRunContext`; any omitted field falls back to its default.
 * @returns Promise resolving to the return value of `run`.
 *
 * @example
 * ```typescript
 * const price = await runInMockContext(
 *   () => getEffectivePrice("BTCUSDT"),
 *   { exchangeName: "binance", strategyName: "my-strategy", frameName: "1d" },
 * );
 * ```
 */
export async function runInMockContext<T extends unknown = any>(
  run: Function<T>,
  {
    exchangeName = "mock-exchange",
    frameName = "mock-frame",
    strategyName = "mock-strategy",
    symbol = "BTCUSDT",
    backtest: isBacktest = false,
    when = alignToInterval(new Date(), "1m"),
  }: Partial<IRunContext>,
): Promise<T> {
  backtest.loggerService.info(RUN_IN_MOCK_CONTEXT_METHOD_NAME, { symbol, exchangeName, strategyName, frameName });
  const context: IRunContext = {
    exchangeName,
    frameName,
    strategyName,
    symbol,
    backtest: isBacktest,
    when,
  };

  return await runInContextInternal(run, context);
}
