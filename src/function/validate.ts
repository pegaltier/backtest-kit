import lib from "../lib";

const METHOD_NAME = "validate.validate";

/**
 * Type alias for enum objects with string key-value pairs
 */
type Enum = Record<string, string>;

/**
 * Type alias for ValidateArgs with any enum type
 */
type Args = ValidateArgs<any>;

/**
 * Interface defining validation arguments for all entity types.
 *
 * Each property accepts an enum object where values will be validated
 * against registered entities in their respective validation services.
 *
 * @template T - Enum type extending Record<string, string>
 */
interface ValidateArgs<T = Enum> {
  /**
   * Exchange name enum to validate
   * @example { BINANCE: "binance", BYBIT: "bybit" }
   */
  ExchangeName?: T;

  /**
   * Frame (timeframe) name enum to validate
   * @example { Q1_2024: "2024-Q1", Q2_2024: "2024-Q2" }
   */
  FrameName?: T;

  /**
   * Strategy name enum to validate
   * @example { MOMENTUM_BTC: "momentum-btc" }
   */
  StrategyName?: T;

  /**
   * Risk profile name enum to validate
   * @example { CONSERVATIVE: "conservative", AGGRESSIVE: "aggressive" }
   */
  RiskName?: T;

  /**
   * Sizing strategy name enum to validate
   * @example { FIXED_1000: "fixed-1000" }
   */
  SizingName?: T;

  /**
   * Optimizer name enum to validate
   * @example { GRID_SEARCH: "grid-search" }
   */
  OptimizerName?: T;

  /**
   * Walker (parameter sweep) name enum to validate
   * @example { RSI_SWEEP: "rsi-sweep" }
   */
  WalkerName?: T;
}

/**
 * Internal validation function that processes all provided entity enums.
 *
 * Iterates through each enum's values and validates them against their
 * respective validation services. Uses memoized validation for performance.
 *
 * @private
 * @param args - Validation arguments containing entity name enums
 * @throws {Error} If any entity name is not found in its registry
 */
const validateInternal = ({
  ExchangeName = {},
  FrameName = {},
  StrategyName = {},
  RiskName = {},
  SizingName = {},
  OptimizerName = {},
  WalkerName = {},
}: ValidateArgs<Enum>) => {
  for (const exchangeName of Object.values(ExchangeName)) {
    lib.exchangeValidationService.validate(exchangeName, METHOD_NAME);
  }
  for (const frameName of Object.values(FrameName)) {
    lib.frameValidationService.validate(frameName, METHOD_NAME);
  }
  for (const strategyName of Object.values(StrategyName)) {
    lib.strategyValidationService.validate(strategyName, METHOD_NAME);
  }
  for (const riskName of Object.values(RiskName)) {
    lib.riskValidationService.validate(riskName, METHOD_NAME);
  }
  for (const sizingName of Object.values(SizingName)) {
    lib.sizingValidationService.validate(sizingName, METHOD_NAME);
  }
  for (const optimizerName of Object.values(OptimizerName)) {
    lib.optimizerValidationService.validate(optimizerName, METHOD_NAME);
  }
  for (const walkerName of Object.values(WalkerName)) {
    lib.walkerValidationService.validate(walkerName, METHOD_NAME);
  }
};

/**
 * Validates the existence of all provided entity names across validation services.
 *
 * This function accepts enum objects for various entity types (exchanges, frames,
 * strategies, risks, sizings, optimizers, walkers) and validates that each entity
 * name exists in its respective registry. Validation results are memoized for performance.
 *
 * Use this before running backtests or optimizations to ensure all referenced
 * entities are properly registered and configured.
 *
 * @public
 * @param args - Partial validation arguments containing entity name enums to validate
 * @throws {Error} If any entity name is not found in its validation service
 *
 * @example
 * ```typescript
 * // Define your entity name enums
 * enum ExchangeName {
 *   BINANCE = "binance",
 *   BYBIT = "bybit"
 * }
 *
 * enum StrategyName {
 *   MOMENTUM_BTC = "momentum-btc"
 * }
 *
 * // Validate all entities before running backtest
 * validate({
 *   ExchangeName,
 *   StrategyName,
 * });
 * ```
 *
 * @example
 * ```typescript
 * // Validate specific entity types
 * validate({
 *   RiskName: { CONSERVATIVE: "conservative" },
 *   SizingName: { FIXED_1000: "fixed-1000" },
 * });
 * ```
 */
export function validate(args: Partial<Args>) {
  lib.loggerService.log(METHOD_NAME);
  return validateInternal(args);
}
