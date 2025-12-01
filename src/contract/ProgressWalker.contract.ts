/**
 * Contract for walker progress events.
 *
 * Emitted during Walker.background() execution to track progress.
 * Contains information about total strategies, processed strategies, and completion percentage.
 *
 * @example
 * ```typescript
 * import { listenWalkerProgress } from "backtest-kit";
 *
 * listenWalkerProgress((event) => {
 *   console.log(`Progress: ${(event.progress * 100).toFixed(2)}%`);
 *   console.log(`Processed: ${event.processedStrategies} / ${event.totalStrategies}`);
 * });
 * ```
 */
export interface ProgressWalkerContract {
    /** walkerName - Name of the walker being executed */
    walkerName: string;
    /** exchangeName - Name of the exchange used in execution */
    exchangeName: string;
    /** frameName - Name of the frame being used */
    frameName: string;
    /** symbol - Trading symbol (e.g., "BTCUSDT") */
    symbol: string;
    /** totalStrategies - Total number of strategies to process */
    totalStrategies: number;
    /** processedStrategies - Number of strategies processed so far */
    processedStrategies: number;
    /** progress - Completion percentage from 0.0 to 1.0 */
    progress: number;
}

export default ProgressWalkerContract;
