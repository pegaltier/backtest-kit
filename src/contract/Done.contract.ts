import { ExchangeName } from "src/interfaces/Exchange.interface";
import { FrameName } from "src/interfaces/Frame.interface";
import { StrategyName } from "src/interfaces/Strategy.interface";

/**
 * Contract for background execution completion events.
 *
 * Emitted when Live.background() or Backtest.background() completes execution.
 * Contains metadata about the completed execution context.
 *
 * @example
 * ```typescript
 * import { listenDone } from "backtest-kit";
 *
 * listenDone((event) => {
 *   if (event.backtest) {
 *     console.log("Backtest completed:", event.symbol);
 *   } else {
 *     console.log("Live trading completed:", event.symbol);
 *   }
 * });
 * ```
 */
export interface DoneContract {
    /** exchangeName - Name of the exchange used in execution */
    exchangeName: ExchangeName;
    /** strategyName - Name of the strategy that completed */
    strategyName: StrategyName;
    /** frameName - Name of the frame (empty string for live mode) */
    frameName: FrameName;
    /** backtest - True if backtest mode, false if live mode */
    backtest: boolean;
    /** symbol - Trading symbol (e.g., "BTCUSDT") */
    symbol: string;
}

export default DoneContract;
