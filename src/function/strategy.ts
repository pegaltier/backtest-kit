import backtest, {
  ExecutionContextService,
  MethodContextService,
} from "../lib";
import { getAveragePrice } from "./exchange";

const STOP_METHOD_NAME = "strategy.stop";
const CANCEL_METHOD_NAME = "strategy.cancel";
const PARTIAL_PROFIT_METHOD_NAME = "strategy.partialProfit";
const PARTIAL_LOSS_METHOD_NAME = "strategy.partialLoss";

/**
 * Stops the strategy from generating new signals.
 *
 * Sets internal flag to prevent strategy from opening new signals.
 * Current active signal (if any) will complete normally.
 * Backtest/Live mode will stop at the next safe point (idle state or after signal closes).
 *
 * Automatically detects backtest/live mode from execution context.
 *
 * @param symbol - Trading pair symbol
 * @param strategyName - Strategy name to stop
 * @returns Promise that resolves when stop flag is set
 *
 * @example
 * ```typescript
 * import { stop } from "backtest-kit";
 *
 * // Stop strategy after some condition
 * await stop("BTCUSDT", "my-strategy");
 * ```
 */
export async function stop(symbol: string): Promise<void> {
  backtest.loggerService.info(STOP_METHOD_NAME, {
    symbol,
  });
  if (!ExecutionContextService.hasContext()) {
    throw new Error("stop requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("stop requires a method context");
  }
  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { exchangeName, frameName, strategyName } =
    backtest.methodContextService.context;
  await backtest.strategyCoreService.stop(isBacktest, symbol, {
    exchangeName,
    frameName,
    strategyName,
  });
}

/**
 * Cancels the scheduled signal without stopping the strategy.
 *
 * Clears the scheduled signal (waiting for priceOpen activation).
 * Does NOT affect active pending signals or strategy operation.
 * Does NOT set stop flag - strategy can continue generating new signals.
 *
 * Automatically detects backtest/live mode from execution context.
 *
 * @param symbol - Trading pair symbol
 * @param strategyName - Strategy name
 * @param cancelId - Optional cancellation ID for tracking user-initiated cancellations
 * @returns Promise that resolves when scheduled signal is cancelled
 *
 * @example
 * ```typescript
 * import { cancel } from "backtest-kit";
 *
 * // Cancel scheduled signal with custom ID
 * await cancel("BTCUSDT", "my-strategy", "manual-cancel-001");
 * ```
 */
export async function cancel(symbol: string, cancelId?: string): Promise<void> {
  backtest.loggerService.info(CANCEL_METHOD_NAME, {
    symbol,
    cancelId,
  });
  if (!ExecutionContextService.hasContext()) {
    throw new Error("cancel requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("cancel requires a method context");
  }
  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { exchangeName, frameName, strategyName } =
    backtest.methodContextService.context;
  await backtest.strategyCoreService.cancel(
    isBacktest,
    symbol,
    { exchangeName, frameName, strategyName },
    cancelId
  );
}

/**
 * Executes partial close at profit level (moving toward TP).
 *
 * Closes a percentage of the active pending position at profit.
 * Price must be moving toward take profit (in profit direction).
 *
 * Automatically detects backtest/live mode from execution context.
 *
 * @param symbol - Trading pair symbol
 * @param percentToClose - Percentage of position to close (0-100, absolute value)
 * @returns Promise that resolves when state is updated
 *
 * @throws Error if currentPrice is not in profit direction:
 *   - LONG: currentPrice must be > priceOpen
 *   - SHORT: currentPrice must be < priceOpen
 *
 * @example
 * ```typescript
 * import { partialProfit } from "backtest-kit";
 *
 * // Close 30% of LONG position at profit
 * await partialProfit("BTCUSDT", 30, 45000);
 * ```
 */
export async function partialProfit(
  symbol: string,
  percentToClose: number,
): Promise<void> {
  backtest.loggerService.info(PARTIAL_PROFIT_METHOD_NAME, {
    symbol,
    percentToClose,
  });
  if (!ExecutionContextService.hasContext()) {
    throw new Error("partialProfit requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("partialProfit requires a method context");
  }
  const currentPrice = await getAveragePrice(symbol);
  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { exchangeName, frameName, strategyName } =
    backtest.methodContextService.context;
  await backtest.strategyCoreService.partialProfit(
    isBacktest,
    symbol,
    percentToClose,
    currentPrice,
    { exchangeName, frameName, strategyName }
  );
}

/**
 * Executes partial close at loss level (moving toward SL).
 *
 * Closes a percentage of the active pending position at loss.
 * Price must be moving toward stop loss (in loss direction).
 *
 * Automatically detects backtest/live mode from execution context.
 *
 * @param symbol - Trading pair symbol
 * @param percentToClose - Percentage of position to close (0-100, absolute value)
 * @returns Promise that resolves when state is updated
 *
 * @throws Error if currentPrice is not in loss direction:
 *   - LONG: currentPrice must be < priceOpen
 *   - SHORT: currentPrice must be > priceOpen
 *
 * @example
 * ```typescript
 * import { partialLoss } from "backtest-kit";
 *
 * // Close 40% of LONG position at loss
 * await partialLoss("BTCUSDT", 40, 38000);
 * ```
 */
export async function partialLoss(
  symbol: string,
  percentToClose: number,
): Promise<void> {
  backtest.loggerService.info(PARTIAL_LOSS_METHOD_NAME, {
    symbol,
    percentToClose,
  });
  if (!ExecutionContextService.hasContext()) {
    throw new Error("partialLoss requires an execution context");
  }
  if (!MethodContextService.hasContext()) {
    throw new Error("partialLoss requires a method context");
  }
  const currentPrice = await getAveragePrice(symbol);
  const { backtest: isBacktest } = backtest.executionContextService.context;
  const { exchangeName, frameName, strategyName } =
    backtest.methodContextService.context;
  await backtest.strategyCoreService.partialLoss(
    isBacktest,
    symbol,
    percentToClose,
    currentPrice,
    { exchangeName, frameName, strategyName }
  );
}

export default { stop, cancel, partialProfit, partialLoss };
