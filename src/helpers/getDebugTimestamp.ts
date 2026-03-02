import backtest, { ExecutionContextService } from "../lib"

/**
 * Retrieves the current timestamp for debugging purposes.
 * If an execution context is active (e.g., during a backtest), it returns the timestamp from the context to ensure consistency with the simulated time.
 * Can be empty (undefined) if not called from strategy async context, as it's intended for debugging and not critical for logic.
 * @return {number | undefined} The current timestamp in milliseconds from the execution context, or undefined if not available.
 */
export const getDebugTimestamp = () => {
    if (ExecutionContextService.hasContext()) {
        return backtest.executionContextService.context.when.getTime();
    }
    return undefined;
}
