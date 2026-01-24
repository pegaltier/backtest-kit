import { StrategyName } from "../interfaces/Strategy.interface";
import bt from "../lib";
import { Columns } from "../lib/services/markdown/StrategyMarkdownService";
import { ExchangeName } from "../interfaces/Exchange.interface";
import { FrameName } from "../interfaces/Frame.interface";

const STRATEGY_METHOD_NAME_GET_DATA = "StrategyUtils.getData";
const STRATEGY_METHOD_NAME_GET_REPORT = "StrategyUtils.getReport";
const STRATEGY_METHOD_NAME_DUMP = "StrategyUtils.dump";

/**
 * Utility class for accessing strategy management reports and statistics.
 *
 * Provides static-like methods (via singleton instance) to retrieve data
 * accumulated by StrategyMarkdownService from strategy management events.
 *
 * Features:
 * - Statistical data extraction (event counts by action type)
 * - Markdown report generation with event tables
 * - File export to disk
 *
 * Data source:
 * - StrategyMarkdownService receives events via direct method calls
 * - Accumulates events in ReportStorage (max 250 events per symbol-strategy pair)
 * - Events include: cancel-scheduled, close-pending, partial-profit, partial-loss,
 *   trailing-stop, trailing-take, breakeven
 *
 * @example
 * ```typescript
 * import { Strategy } from "./classes/Strategy";
 *
 * // Get statistical data for BTCUSDT:my-strategy
 * const stats = await Strategy.getData("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" });
 * console.log(`Total events: ${stats.totalEvents}`);
 * console.log(`Partial profit events: ${stats.partialProfitCount}`);
 *
 * // Generate markdown report
 * const markdown = await Strategy.getReport("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" });
 * console.log(markdown); // Formatted table with all events
 *
 * // Export report to file
 * await Strategy.dump("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" }); // Saves to ./dump/strategy/
 * ```
 */
export class StrategyUtils {
  /**
   * Retrieves statistical data from accumulated strategy events.
   *
   * Delegates to StrategyMarkdownService.getData() which reads from ReportStorage.
   * Returns aggregated metrics calculated from all strategy events.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param context - Strategy context with strategyName, exchangeName, frameName
   * @param backtest - Whether to get backtest data (default: false)
   * @returns Promise resolving to StrategyStatisticsModel object with counts and event list
   *
   * @example
   * ```typescript
   * const stats = await Strategy.getData("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" });
   *
   * console.log(`Total events: ${stats.totalEvents}`);
   * console.log(`Partial profit: ${stats.partialProfitCount}`);
   * console.log(`Trailing stop: ${stats.trailingStopCount}`);
   *
   * // Iterate through all events
   * for (const event of stats.eventList) {
   *   console.log(`Signal ${event.signalId}: ${event.action} at ${event.currentPrice}`);
   * }
   * ```
   */
  public getData = async (
    symbol: string,
    context: {
      strategyName: StrategyName;
      exchangeName: ExchangeName;
      frameName: FrameName;
    },
    backtest = false
  ) => {
    bt.loggerService.info(STRATEGY_METHOD_NAME_GET_DATA, { symbol, strategyName: context.strategyName });

    bt.strategyValidationService.validate(context.strategyName, STRATEGY_METHOD_NAME_GET_DATA);
    bt.exchangeValidationService.validate(context.exchangeName, STRATEGY_METHOD_NAME_GET_DATA);
    context.frameName && bt.frameValidationService.validate(context.frameName, STRATEGY_METHOD_NAME_GET_DATA);

    {
      const { riskName, riskList, actions } = bt.strategySchemaService.get(context.strategyName);
      riskName && bt.riskValidationService.validate(riskName, STRATEGY_METHOD_NAME_GET_DATA);
      riskList && riskList.forEach((riskName) => bt.riskValidationService.validate(riskName, STRATEGY_METHOD_NAME_GET_DATA));
      actions && actions.forEach((actionName) => bt.actionValidationService.validate(actionName, STRATEGY_METHOD_NAME_GET_DATA));
    }

    return await bt.strategyMarkdownService.getData(symbol, context.strategyName, context.exchangeName, context.frameName, backtest);
  };

  /**
   * Generates markdown report with all strategy events for a symbol-strategy pair.
   *
   * Creates formatted table containing:
   * - Symbol
   * - Strategy
   * - Signal ID
   * - Action (cancel-scheduled, close-pending, partial-profit, etc.)
   * - Price
   * - Percent values (% To Close, % Shift)
   * - Cancel/Close IDs
   * - Timestamp (ISO 8601)
   * - Mode (Backtest/Live)
   *
   * Also includes summary statistics at the end with counts by action type.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param context - Strategy context with strategyName, exchangeName, frameName
   * @param backtest - Whether to get backtest data (default: false)
   * @param columns - Optional columns configuration for the report
   * @returns Promise resolving to markdown formatted report string
   *
   * @example
   * ```typescript
   * const markdown = await Strategy.getReport("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" });
   * console.log(markdown);
   *
   * // Output:
   * // # Strategy Report: BTCUSDT:my-strategy
   * //
   * // | Symbol | Strategy | Signal ID | Action | Price | ... |
   * // | --- | --- | --- | --- | --- | ... |
   * // | BTCUSDT | my-strategy | abc123 | partial-profit | 50100.00000000 USD | ... |
   * //
   * // **Total events:** 5
   * // - Cancel scheduled: 0
   * // - Close pending: 1
   * // - Partial profit: 2
   * // ...
   * ```
   */
  public getReport = async (
    symbol: string,
    context: {
      strategyName: StrategyName;
      exchangeName: ExchangeName;
      frameName: FrameName;
    },
    backtest = false,
    columns?: Columns[]
  ): Promise<string> => {
    bt.loggerService.info(STRATEGY_METHOD_NAME_GET_REPORT, { symbol, strategyName: context.strategyName });

    bt.strategyValidationService.validate(context.strategyName, STRATEGY_METHOD_NAME_GET_REPORT);
    bt.exchangeValidationService.validate(context.exchangeName, STRATEGY_METHOD_NAME_GET_REPORT);
    context.frameName && bt.frameValidationService.validate(context.frameName, STRATEGY_METHOD_NAME_GET_REPORT);

    {
      const { riskName, riskList, actions } = bt.strategySchemaService.get(context.strategyName);
      riskName && bt.riskValidationService.validate(riskName, STRATEGY_METHOD_NAME_GET_REPORT);
      riskList && riskList.forEach((riskName) => bt.riskValidationService.validate(riskName, STRATEGY_METHOD_NAME_GET_REPORT));
      actions && actions.forEach((actionName) => bt.actionValidationService.validate(actionName, STRATEGY_METHOD_NAME_GET_REPORT));
    }

    return await bt.strategyMarkdownService.getReport(symbol, context.strategyName, context.exchangeName, context.frameName, backtest, columns);
  };

  /**
   * Generates and saves markdown report to file.
   *
   * Creates directory if it doesn't exist.
   * Filename format: {symbol}_{strategyName}_{exchangeName}_{frameName|live}-{timestamp}.md
   *
   * Delegates to StrategyMarkdownService.dump() which:
   * 1. Generates markdown report via getReport()
   * 2. Creates output directory (recursive mkdir)
   * 3. Writes file with UTF-8 encoding
   * 4. Logs success/failure to console
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param context - Strategy context with strategyName, exchangeName, frameName
   * @param backtest - Whether to dump backtest data (default: false)
   * @param path - Output directory path (default: "./dump/strategy")
   * @param columns - Optional columns configuration for the report
   * @returns Promise that resolves when file is written
   *
   * @example
   * ```typescript
   * // Save to default path: ./dump/strategy/BTCUSDT_my-strategy_binance_1h_backtest-{timestamp}.md
   * await Strategy.dump("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" }, true);
   *
   * // Save to custom path
   * await Strategy.dump("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" }, true, "./reports/strategy");
   *
   * // After multiple symbols backtested, export all reports
   * for (const symbol of ["BTCUSDT", "ETHUSDT", "BNBUSDT"]) {
   *   await Strategy.dump(symbol, { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" }, true, "./backtest-results");
   * }
   * ```
   */
  public dump = async (
    symbol: string,
    context: {
      strategyName: StrategyName;
      exchangeName: ExchangeName;
      frameName: FrameName;
    },
    backtest = false,
    path?: string,
    columns?: Columns[]
  ): Promise<void> => {
    bt.loggerService.info(STRATEGY_METHOD_NAME_DUMP, { symbol, strategyName: context.strategyName, path });

    bt.strategyValidationService.validate(context.strategyName, STRATEGY_METHOD_NAME_DUMP);
    bt.exchangeValidationService.validate(context.exchangeName, STRATEGY_METHOD_NAME_DUMP);
    context.frameName && bt.frameValidationService.validate(context.frameName, STRATEGY_METHOD_NAME_DUMP);

    {
      const { riskName, riskList, actions } = bt.strategySchemaService.get(context.strategyName);
      riskName && bt.riskValidationService.validate(riskName, STRATEGY_METHOD_NAME_DUMP);
      riskList && riskList.forEach((riskName) => bt.riskValidationService.validate(riskName, STRATEGY_METHOD_NAME_DUMP));
      actions && actions.forEach((actionName) => bt.actionValidationService.validate(actionName, STRATEGY_METHOD_NAME_DUMP));
    }

    await bt.strategyMarkdownService.dump(symbol, context.strategyName, context.exchangeName, context.frameName, backtest, path, columns);
  };
}

/**
 * Global singleton instance of StrategyUtils.
 * Provides static-like access to strategy management reporting methods.
 *
 * @example
 * ```typescript
 * import { Strategy } from "backtest-kit";
 *
 * // Usage same as StrategyUtils methods
 * const stats = await Strategy.getData("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" });
 * const report = await Strategy.getReport("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" });
 * await Strategy.dump("BTCUSDT", { strategyName: "my-strategy", exchangeName: "binance", frameName: "1h" });
 * ```
 */
export const Strategy = new StrategyUtils();
