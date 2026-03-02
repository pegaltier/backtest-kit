import { ISignalRow, IStrategyPnL } from "../interfaces/Strategy.interface";
import { GLOBAL_CONFIG } from "../config/params";
import { getEffectivePriceOpen } from "./getEffectivePriceOpen";

/**
 * Calculates profit/loss for a closed signal with slippage and fees.
 *
 * For signals with partial closes:
 * - Weights are calculated by ACTUAL DOLLAR VALUE of each partial relative to total invested,
 *   not by raw percent. This correctly handles DCA entries that occur after partial closes.
 *
 * Weight formula:
 *   partialDollarValue = (partial.percent / 100) * (partial.entryCountAtClose * $100)
 *   weight = partialDollarValue / totalInvested
 *   totalInvested = _entry.length * $100
 *
 * Fee structure:
 *   - Open fee: CC_PERCENT_FEE (charged once)
 *   - Close fee per partial: CC_PERCENT_FEE × weight × (closeWithSlip / openWithSlip)
 *
 * @param signal - Closed signal with position details and optional partial history
 * @param priceClose - Actual close price at final exit
 * @returns PNL data with percentage and prices
 */
export const toProfitLossDto = (
  signal: ISignalRow,
  priceClose: number
): IStrategyPnL => {
  const priceOpen = getEffectivePriceOpen(signal);

  // Calculate weighted PNL with partial closes
  if (signal._partial && signal._partial.length > 0) {
    let totalWeightedPnl = 0;

    // Open fee is paid once for the whole position
    let totalFees = GLOBAL_CONFIG.CC_PERCENT_FEE;

    // Total invested capital = number of DCA entries × $100 per entry
    const totalInvested = signal._entry ? signal._entry.length * 100 : 100;

    // Calculate PNL for each partial close
    for (const partial of signal._partial) {
      // Real dollar value of this partial at the moment it was closed
      const partialDollarValue = (partial.percent / 100) * (partial.entryCountAtClose * 100);

      // Weight relative to total invested capital (handles DCA after partial)
      const weight = partialDollarValue / totalInvested;

      // Use the effective entry price snapshot captured at the time of this partial close
      const priceOpenWithSlippage =
        signal.position === "long"
          ? partial.effectivePrice * (1 + GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100)
          : partial.effectivePrice * (1 - GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);

      const priceCloseWithSlippage =
        signal.position === "long"
          ? partial.price * (1 - GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100)
          : partial.price * (1 + GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);

      const partialPnl =
        signal.position === "long"
          ? ((priceCloseWithSlippage - priceOpenWithSlippage) / priceOpenWithSlippage) * 100
          : ((priceOpenWithSlippage - priceCloseWithSlippage) / priceOpenWithSlippage) * 100;

      totalWeightedPnl += weight * partialPnl;

      // Close fee proportional to real dollar weight
      totalFees +=
        GLOBAL_CONFIG.CC_PERCENT_FEE *
        weight *
        (priceCloseWithSlippage / priceOpenWithSlippage);
    }

    // Calculate dollar value already closed across all partials
    const closedDollarValue = signal._partial.reduce(
      (sum, p) => sum + (p.percent / 100) * (p.entryCountAtClose * 100),
      0
    );

    if (closedDollarValue > totalInvested + 0.001) {
      throw new Error(
        `Partial closes dollar value (${closedDollarValue}) exceeds total invested (${totalInvested}) — signal id: ${signal.id}`
      );
    }

    const remainingDollarValue = totalInvested - closedDollarValue;
    const remainingWeight = remainingDollarValue / totalInvested;

    if (remainingWeight > 0) {
      // For remaining position use current effective price (reflects all DCA including post-partial)
      const remainingOpenWithSlippage =
        signal.position === "long"
          ? priceOpen * (1 + GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100)
          : priceOpen * (1 - GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);

      const priceCloseWithSlippage =
        signal.position === "long"
          ? priceClose * (1 - GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100)
          : priceClose * (1 + GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);

      const remainingPnl =
        signal.position === "long"
          ? ((priceCloseWithSlippage - remainingOpenWithSlippage) / remainingOpenWithSlippage) * 100
          : ((remainingOpenWithSlippage - priceCloseWithSlippage) / remainingOpenWithSlippage) * 100;

      totalWeightedPnl += remainingWeight * remainingPnl;

      totalFees +=
        GLOBAL_CONFIG.CC_PERCENT_FEE *
        remainingWeight *
        (priceCloseWithSlippage / remainingOpenWithSlippage);
    }

    const pnlPercentage = totalWeightedPnl - totalFees;

    return {
      pnlPercentage,
      priceOpen,
      priceClose,
    };
  }

  // Original logic for signals without partial closes
  let priceOpenWithSlippage: number;
  let priceCloseWithSlippage: number;

  if (signal.position === "long") {
    priceOpenWithSlippage = priceOpen * (1 + GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);
    priceCloseWithSlippage = priceClose * (1 - GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);
  } else {
    priceOpenWithSlippage = priceOpen * (1 - GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);
    priceCloseWithSlippage = priceClose * (1 + GLOBAL_CONFIG.CC_PERCENT_SLIPPAGE / 100);
  }

  const totalFee =
    GLOBAL_CONFIG.CC_PERCENT_FEE *
    (1 + priceCloseWithSlippage / priceOpenWithSlippage);

  let pnlPercentage: number;

  if (signal.position === "long") {
    pnlPercentage =
      ((priceCloseWithSlippage - priceOpenWithSlippage) / priceOpenWithSlippage) * 100;
  } else {
    pnlPercentage =
      ((priceOpenWithSlippage - priceCloseWithSlippage) / priceOpenWithSlippage) * 100;
  }

  pnlPercentage -= totalFee;

  return {
    pnlPercentage,
    priceOpen,
    priceClose,
  };
};

export default toProfitLossDto;
