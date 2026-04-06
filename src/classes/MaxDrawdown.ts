import { StrategyName } from "../interfaces/Strategy.interface";
import bt from "../lib";
import { Columns } from "../lib/services/markdown/MaxDrawdownMarkdownService";
import { ExchangeName } from "../interfaces/Exchange.interface";
import { FrameName } from "../interfaces/Frame.interface";

const MAX_DRAWDOWN_METHOD_NAME_GET_DATA = "MaxDrawdownUtils.getData";
const MAX_DRAWDOWN_METHOD_NAME_GET_REPORT = "MaxDrawdownUtils.getReport";
const MAX_DRAWDOWN_METHOD_NAME_DUMP = "MaxDrawdownUtils.dump";

/**
 * Utility class for accessing max drawdown reports and statistics.
 *
 * Provides static-like methods (via singleton instance) to retrieve data
 * accumulated by MaxDrawdownMarkdownService from maxDrawdownSubject events.
 *
 * @example
 * ```typescript
 * import { MaxDrawdown } from "backtest-kit";
 *
 * const stats = await MaxDrawdown.getData("BTCUSDT", { strategyName, exchangeName, frameName });
 * const report = await MaxDrawdown.getReport("BTCUSDT", { strategyName, exchangeName, frameName });
 * await MaxDrawdown.dump("BTCUSDT", { strategyName, exchangeName, frameName });
 * ```
 */
export class MaxDrawdownUtils {
  /**
   * Retrieves statistical data from accumulated max drawdown events.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param context - Execution context
   * @param backtest - Whether to query backtest data
   * @returns Promise resolving to MaxDrawdownStatisticsModel
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
    bt.loggerService.info(MAX_DRAWDOWN_METHOD_NAME_GET_DATA, { symbol, strategyName: context.strategyName });

    bt.strategyValidationService.validate(context.strategyName, MAX_DRAWDOWN_METHOD_NAME_GET_DATA);
    bt.exchangeValidationService.validate(context.exchangeName, MAX_DRAWDOWN_METHOD_NAME_GET_DATA);
    context.frameName && bt.frameValidationService.validate(context.frameName, MAX_DRAWDOWN_METHOD_NAME_GET_DATA);

    {
      const { riskName, riskList, actions } = bt.strategySchemaService.get(context.strategyName);
      riskName && bt.riskValidationService.validate(riskName, MAX_DRAWDOWN_METHOD_NAME_GET_DATA);
      riskList && riskList.forEach((riskName) => bt.riskValidationService.validate(riskName, MAX_DRAWDOWN_METHOD_NAME_GET_DATA));
      actions && actions.forEach((actionName) => bt.actionValidationService.validate(actionName, MAX_DRAWDOWN_METHOD_NAME_GET_DATA));
    }

    return await bt.maxDrawdownMarkdownService.getData(symbol, context.strategyName, context.exchangeName, context.frameName, backtest);
  };

  /**
   * Generates a markdown report with all max drawdown events for a symbol-strategy pair.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param context - Execution context
   * @param backtest - Whether to query backtest data
   * @param columns - Optional column configuration
   * @returns Promise resolving to markdown formatted report string
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
    bt.loggerService.info(MAX_DRAWDOWN_METHOD_NAME_GET_REPORT, { symbol, strategyName: context.strategyName });

    bt.strategyValidationService.validate(context.strategyName, MAX_DRAWDOWN_METHOD_NAME_GET_REPORT);
    bt.exchangeValidationService.validate(context.exchangeName, MAX_DRAWDOWN_METHOD_NAME_GET_REPORT);
    context.frameName && bt.frameValidationService.validate(context.frameName, MAX_DRAWDOWN_METHOD_NAME_GET_REPORT);

    {
      const { riskName, riskList, actions } = bt.strategySchemaService.get(context.strategyName);
      riskName && bt.riskValidationService.validate(riskName, MAX_DRAWDOWN_METHOD_NAME_GET_REPORT);
      riskList && riskList.forEach((riskName) => bt.riskValidationService.validate(riskName, MAX_DRAWDOWN_METHOD_NAME_GET_REPORT));
      actions && actions.forEach((actionName) => bt.actionValidationService.validate(actionName, MAX_DRAWDOWN_METHOD_NAME_GET_REPORT));
    }

    return await bt.maxDrawdownMarkdownService.getReport(symbol, context.strategyName, context.exchangeName, context.frameName, backtest, columns);
  };

  /**
   * Generates and saves a markdown report to file.
   *
   * @param symbol - Trading pair symbol (e.g., "BTCUSDT")
   * @param context - Execution context
   * @param backtest - Whether to query backtest data
   * @param path - Output directory path (default: "./dump/max_drawdown")
   * @param columns - Optional column configuration
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
    bt.loggerService.info(MAX_DRAWDOWN_METHOD_NAME_DUMP, { symbol, strategyName: context.strategyName, path });

    bt.strategyValidationService.validate(context.strategyName, MAX_DRAWDOWN_METHOD_NAME_DUMP);
    bt.exchangeValidationService.validate(context.exchangeName, MAX_DRAWDOWN_METHOD_NAME_DUMP);
    context.frameName && bt.frameValidationService.validate(context.frameName, MAX_DRAWDOWN_METHOD_NAME_DUMP);

    {
      const { riskName, riskList, actions } = bt.strategySchemaService.get(context.strategyName);
      riskName && bt.riskValidationService.validate(riskName, MAX_DRAWDOWN_METHOD_NAME_DUMP);
      riskList && riskList.forEach((riskName) => bt.riskValidationService.validate(riskName, MAX_DRAWDOWN_METHOD_NAME_DUMP));
      actions && actions.forEach((actionName) => bt.actionValidationService.validate(actionName, MAX_DRAWDOWN_METHOD_NAME_DUMP));
    }

    await bt.maxDrawdownMarkdownService.dump(symbol, context.strategyName, context.exchangeName, context.frameName, backtest, path, columns);
  };
}

/**
 * Global singleton instance of MaxDrawdownUtils.
 */
export const MaxDrawdown = new MaxDrawdownUtils();
