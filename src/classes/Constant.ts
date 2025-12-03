/**
 * Utility class containing predefined trading constants for take-profit and stop-loss levels.
 *
 * Based on Kelly Criterion with exponential risk decay.
 * Values represent percentage of distance traveled towards final TP/SL target.
 * 
 * Example: If final TP is at +10% profit:
 * - TP_LEVEL1 (30) triggers when price reaches 30% of distance = +3% profit
 * - TP_LEVEL2 (60) triggers when price reaches 60% of distance = +6% profit
 * - TP_LEVEL3 (90) triggers when price reaches 90% of distance = +9% profit
 */
export class ConstantUtils {
    /**
     * Take Profit Level 1 (Kelly-optimized early partial).
     * Triggers at 30% of distance to final TP target.
     * Lock in profit early, let rest run.
     */
    public readonly TP_LEVEL1 = 30;

    /**
     * Take Profit Level 2 (Kelly-optimized mid partial).
     * Triggers at 60% of distance to final TP target.
     * Secure majority of position while trend continues.
     */
    public readonly TP_LEVEL2 = 60;

    /**
     * Take Profit Level 3 (Kelly-optimized final partial).
     * Triggers at 90% of distance to final TP target.
     * Near-complete exit, minimal exposure remains.
     */
    public readonly TP_LEVEL3 = 90;

    /**
     * Stop Loss Level 1 (Kelly-optimized early warning).
     * Triggers at 40% of distance to final SL target.
     * Reduce exposure when setup weakens.
     */
    public readonly SL_LEVEL1 = 40;

    /**
     * Stop Loss Level 2 (Kelly-optimized final exit).
     * Triggers at 80% of distance to final SL target.
     * Exit remaining position before catastrophic loss.
     */
    public readonly SL_LEVEL2 = 80;
}

/**
 * Global singleton instance of ConstantUtils.
 * Provides static-like access to predefined trading level constants.
 *
 * Kelly-optimized scaling strategy:
 * Profit side (pyramiding out):
 * - Close 33% at 30% progress (quick profit lock)
 * - Close 33% at 60% progress (secure gains)
 * - Close 34% at 90% progress (exit near target)
 *
 * Loss side (damage control):
 * - Close 50% at 40% progress (reduce risk early)
 * - Close 50% at 80% progress (exit before full stop)
 *
 * @example
 * ```typescript
 * // Final targets: TP at +10%, SL at -5%
 * listenPartialProfit(async (event) => {
 *   // event.level emits: 10, 20, 30, 40, 50...
 *   if (event.level === Constant.TP_LEVEL1) { await close(33); } // at +3% profit
 *   if (event.level === Constant.TP_LEVEL2) { await close(33); } // at +6% profit
 *   if (event.level === Constant.TP_LEVEL3) { await close(34); } // at +9% profit
 * });
 * ```
 *
 * @example
 * ```typescript
 * listenPartialLoss(async (event) => {
 *   // event.level emits: 10, 20, 30, 40, 50...
 *   if (event.level === Constant.SL_LEVEL1) { await close(50); } // at -2% loss
 *   if (event.level === Constant.SL_LEVEL2) { await close(50); } // at -4% loss
 * });
 * ```
 */
export const Constant = new ConstantUtils();