import { inject } from "../../core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../core/types";
import ExecutionContextService from "../context/ExecutionContextService";
import { IStrategyBacktestResult, IStrategyTickResult, StrategyName } from "../../../interfaces/Strategy.interface";
import StrategyConnectionService from "../connection/StrategyConnectionService";
import { ICandleData } from "../../../interfaces/Exchange.interface";

/**
 * Global service for strategy operations with execution context injection.
 *
 * Wraps StrategyConnectionService with ExecutionContextService to inject
 * symbol, when, and backtest parameters into the execution context.
 *
 * Used internally by BacktestLogicPrivateService and LiveLogicPrivateService.
 */
export class StrategyGlobalService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);
  private readonly strategyConnectionService =
    inject<StrategyConnectionService>(TYPES.strategyConnectionService);

  /**
   * Checks signal status at a specific timestamp.
   *
   * Wraps strategy tick() with execution context containing symbol, timestamp,
   * and backtest mode flag.
   *
   * @param symbol - Trading pair symbol
   * @param when - Timestamp for tick evaluation
   * @param backtest - Whether running in backtest mode
   * @returns Discriminated union of tick result (idle, opened, active, closed)
   */
  public tick = async (
    symbol: string,
    when: Date,
    backtest: boolean
  ): Promise<IStrategyTickResult> => {
    this.loggerService.log("strategyGlobalService tick", {
      symbol,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.strategyConnectionService.tick();
      },
      {
        symbol,
        when,
        backtest,
      }
    );
  };

  /**
   * Runs fast backtest against candle array.
   *
   * Wraps strategy backtest() with execution context containing symbol,
   * timestamp, and backtest mode flag.
   *
   * @param symbol - Trading pair symbol
   * @param candles - Array of historical candles to test against
   * @param when - Starting timestamp for backtest
   * @param backtest - Whether running in backtest mode (typically true)
   * @returns Closed signal result with PNL
   */
  public backtest = async (
    symbol: string,
    candles: ICandleData[],
    when: Date,
    backtest: boolean
  ): Promise<IStrategyBacktestResult> => {
    this.loggerService.log("strategyGlobalService backtest", {
      symbol,
      candleCount: candles.length,
      when,
      backtest,
    });
    return await ExecutionContextService.runInContext(
      async () => {
        return await this.strategyConnectionService.backtest(candles);
      },
      {
        symbol,
        when,
        backtest,
      }
    );
  };

  /**
   * Stops the strategy from generating new signals.
   *
   * Delegates to StrategyConnectionService.stop() to set internal flag.
   * Does not require execution context.
   *
   * @param strategyName - Name of strategy to stop
   * @returns Promise that resolves when stop flag is set
   */
  public stop = async (strategyName: StrategyName): Promise<void> => {
    this.loggerService.log("strategyGlobalService stop", {
      strategyName,
    });
    return await this.strategyConnectionService.stop(strategyName);
  };

  /**
   * Clears the memoized ClientStrategy instance from cache.
   *
   * Delegates to StrategyConnectionService.clear() to remove strategy from cache.
   * Forces re-initialization of strategy on next operation.
   *
   * @param strategyName - Name of strategy to clear from cache
   */
  public clear = async (strategyName: StrategyName): Promise<void> => {
    this.loggerService.log("strategyGlobalService clear", {
      strategyName,
    });
    return await this.strategyConnectionService.clear(strategyName);
  };
}

export default StrategyGlobalService;
