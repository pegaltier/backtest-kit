import backtest from "../lib";
import { SizingName } from "../interfaces/Sizing.interface";

const POSITION_SIZE_METHOD_NAME_FIXED = "PositionSize.fixedPercentage";
const POSITION_SIZE_METHOD_NAME_KELLY = "PositionSize.kellyCriterion";
const POSITION_SIZE_METHOD_NAME_ATR = "PositionSize.atrBased";

/**
 * Utility class for position sizing calculations.
 *
 * Provides static methods for each sizing method with validation.
 * Each method validates that the sizing schema matches the requested method.
 *
 * @example
 * ```typescript
 * import { PositionSize } from "./classes/PositionSize";
 *
 * // Fixed percentage sizing
 * const quantity = await PositionSize.fixedPercentage(
 *   "BTCUSDT",
 *   10000,
 *   50000,
 *   49000,
 *   { sizingName: "conservative" }
 * );
 *
 * // Kelly Criterion sizing
 * const quantity = await PositionSize.kellyCriterion(
 *   "BTCUSDT",
 *   10000,
 *   50000,
 *   0.55,
 *   1.5,
 *   { sizingName: "kelly" }
 * );
 *
 * // ATR-based sizing
 * const quantity = await PositionSize.atrBased(
 *   "BTCUSDT",
 *   10000,
 *   50000,
 *   500,
 *   { sizingName: "atr-dynamic" }
 * );
 * ```
 */
export class PositionSizeUtils {
  /**
   * Calculates position size using fixed percentage risk method.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param accountBalance - Current account balance
   * @param priceOpen - Planned entry price
   * @param priceStopLoss - Stop-loss price
   * @param context - Execution context with sizing name
   * @returns Promise resolving to calculated position size
   * @throws Error if sizing schema method is not "fixed-percentage"
   */
  public static fixedPercentage = async (
    symbol: string,
    accountBalance: number,
    priceOpen: number,
    priceStopLoss: number,
    context: { sizingName: SizingName }
  ): Promise<number> => {
    backtest.loggerService.info(POSITION_SIZE_METHOD_NAME_FIXED, {
      context,
      symbol,
    });

    backtest.sizingValidationService.validate(
      context.sizingName,
      POSITION_SIZE_METHOD_NAME_FIXED,
      "fixed-percentage"
    );

    return await backtest.sizingGlobalService.calculate(
      {
        symbol,
        accountBalance,
        priceOpen,
        priceStopLoss,
        method: "fixed-percentage",
      },
      context
    );
  };

  /**
   * Calculates position size using Kelly Criterion method.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param accountBalance - Current account balance
   * @param priceOpen - Planned entry price
   * @param winRate - Win rate (0-1)
   * @param winLossRatio - Average win/loss ratio
   * @param context - Execution context with sizing name
   * @returns Promise resolving to calculated position size
   * @throws Error if sizing schema method is not "kelly-criterion"
   */
  public static kellyCriterion = async (
    symbol: string,
    accountBalance: number,
    priceOpen: number,
    winRate: number,
    winLossRatio: number,
    context: { sizingName: SizingName }
  ): Promise<number> => {
    backtest.loggerService.info(POSITION_SIZE_METHOD_NAME_KELLY, {
      context,
      symbol,
    });

    backtest.sizingValidationService.validate(
      context.sizingName,
      POSITION_SIZE_METHOD_NAME_KELLY,
      "kelly-criterion"
    );

    return await backtest.sizingGlobalService.calculate(
      {
        symbol,
        accountBalance,
        priceOpen,
        winRate,
        winLossRatio,
        method: "kelly-criterion",
      },
      context
    );
  };

  /**
   * Calculates position size using ATR-based method.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param accountBalance - Current account balance
   * @param priceOpen - Planned entry price
   * @param atr - Current ATR value
   * @param context - Execution context with sizing name
   * @returns Promise resolving to calculated position size
   * @throws Error if sizing schema method is not "atr-based"
   */
  public static atrBased = async (
    symbol: string,
    accountBalance: number,
    priceOpen: number,
    atr: number,
    context: { sizingName: SizingName }
  ): Promise<number> => {
    backtest.loggerService.info(POSITION_SIZE_METHOD_NAME_ATR, {
      context,
      symbol,
    });

    backtest.sizingValidationService.validate(
      context.sizingName,
      POSITION_SIZE_METHOD_NAME_ATR,
      "atr-based"
    );

    return await backtest.sizingGlobalService.calculate(
      {
        symbol,
        accountBalance,
        priceOpen,
        atr,
        method: "atr-based",
      },
      context
    );
  };
}

export const PositionSize = PositionSizeUtils;
