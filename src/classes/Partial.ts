import backtest from "../lib";

const PARTIAL_METHOD_NAME_GET_DATA = "PartialUtils.getData";
const PARTIAL_METHOD_NAME_GET_REPORT = "PartialUtils.getReport";
const PARTIAL_METHOD_NAME_DUMP = "PartialUtils.dump";

/**
 * Utility class for accessing partial profit/loss reports and statistics.
 *
 * Provides static-like methods (via singleton instance) to retrieve data
 * accumulated by PartialMarkdownService from partial profit/loss events.
 *
 * Features:
 * - Statistical data extraction (total profit/loss events count)
 * - Markdown report generation with event tables
 * - File export to disk
 *
 * Data source:
 * - PartialMarkdownService listens to partialProfitSubject/partialLossSubject
 * - Accumulates events in ReportStorage (max 250 events per symbol)
 * - Events include: timestamp, action, symbol, signalId, position, level, price, mode
 *
 * @example
 * ```typescript
 * import { Partial } from "./classes/Partial";
 *
 * // Get statistical data for BTCUSDT
 * const stats = await Partial.getData("BTCUSDT");
 * console.log(`Total events: ${stats.totalEvents}`);
 * console.log(`Profit events: ${stats.totalProfit}`);
 * console.log(`Loss events: ${stats.totalLoss}`);
 *
 * // Generate markdown report
 * const markdown = await Partial.getReport("BTCUSDT");
 * console.log(markdown); // Formatted table with all events
 *
 * // Export report to file
 * await Partial.dump("BTCUSDT"); // Saves to ./dump/partial/BTCUSDT.md
 * await Partial.dump("BTCUSDT", "./custom/path"); // Custom directory
 * ```
 */
export class PartialUtils {
  /**
   * Retrieves statistical data from accumulated partial profit/loss events.
   *
   * Delegates to PartialMarkdownService.getData() which reads from ReportStorage.
   * Returns aggregated metrics calculated from all profit and loss events.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @returns Promise resolving to PartialStatistics object with counts and event list
   *
   * @example
   * ```typescript
   * const stats = await Partial.getData("BTCUSDT");
   *
   * console.log(`Total events: ${stats.totalEvents}`);
   * console.log(`Profit events: ${stats.totalProfit} (${(stats.totalProfit / stats.totalEvents * 100).toFixed(1)}%)`);
   * console.log(`Loss events: ${stats.totalLoss} (${(stats.totalLoss / stats.totalEvents * 100).toFixed(1)}%)`);
   *
   * // Iterate through all events
   * for (const event of stats.eventList) {
   *   console.log(`${event.action.toUpperCase()}: Signal ${event.signalId} reached ${event.level}%`);
   * }
   * ```
   */
  public getData = async (symbol: string) => {
    backtest.loggerService.info(PARTIAL_METHOD_NAME_GET_DATA, { symbol });
    return await backtest.partialMarkdownService.getData(symbol);
  };

  /**
   * Generates markdown report with all partial profit/loss events for a symbol.
   *
   * Creates formatted table containing:
   * - Action (PROFIT/LOSS)
   * - Symbol
   * - Signal ID
   * - Position (LONG/SHORT)
   * - Level % (+10%, -20%, etc)
   * - Current Price
   * - Timestamp (ISO 8601)
   * - Mode (Backtest/Live)
   *
   * Also includes summary statistics at the end.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @returns Promise resolving to markdown formatted report string
   *
   * @example
   * ```typescript
   * const markdown = await Partial.getReport("BTCUSDT");
   * console.log(markdown);
   *
   * // Output:
   * // # Partial Profit/Loss Report: BTCUSDT
   * //
   * // | Action | Symbol | Signal ID | Position | Level % | Current Price | Timestamp | Mode |
   * // | --- | --- | --- | --- | --- | --- | --- | --- |
   * // | PROFIT | BTCUSDT | abc123 | LONG | +10% | 51500.00000000 USD | 2024-01-15T10:30:00.000Z | Backtest |
   * // | LOSS | BTCUSDT | abc123 | LONG | -10% | 49000.00000000 USD | 2024-01-15T11:00:00.000Z | Backtest |
   * //
   * // **Total events:** 2
   * // **Profit events:** 1
   * // **Loss events:** 1
   * ```
   */
  public getReport = async (symbol: string): Promise<string> => {
    backtest.loggerService.info(PARTIAL_METHOD_NAME_GET_REPORT, { symbol });
    return await backtest.partialMarkdownService.getReport(symbol);
  };

  /**
   * Generates and saves markdown report to file.
   *
   * Creates directory if it doesn't exist.
   * Filename format: {symbol}.md (e.g., "BTCUSDT.md")
   *
   * Delegates to PartialMarkdownService.dump() which:
   * 1. Generates markdown report via getReport()
   * 2. Creates output directory (recursive mkdir)
   * 3. Writes file with UTF-8 encoding
   * 4. Logs success/failure to console
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param path - Output directory path (default: "./dump/partial")
   * @returns Promise that resolves when file is written
   *
   * @example
   * ```typescript
   * // Save to default path: ./dump/partial/BTCUSDT.md
   * await Partial.dump("BTCUSDT");
   *
   * // Save to custom path: ./reports/partial/BTCUSDT.md
   * await Partial.dump("BTCUSDT", "./reports/partial");
   *
   * // After multiple symbols backtested, export all reports
   * for (const symbol of ["BTCUSDT", "ETHUSDT", "BNBUSDT"]) {
   *   await Partial.dump(symbol, "./backtest-results");
   * }
   * ```
   */
  public dump = async (symbol: string, path?: string): Promise<void> => {
    backtest.loggerService.info(PARTIAL_METHOD_NAME_DUMP, { symbol, path });
    await backtest.partialMarkdownService.dump(symbol, path);
  };
}

/**
 * Global singleton instance of PartialUtils.
 * Provides static-like access to partial profit/loss reporting methods.
 *
 * @example
 * ```typescript
 * import { Partial } from "backtest-kit";
 *
 * // Usage same as PartialUtils methods
 * const stats = await Partial.getData("BTCUSDT");
 * const report = await Partial.getReport("BTCUSDT");
 * await Partial.dump("BTCUSDT");
 * ```
 */
export const Partial = new PartialUtils();
