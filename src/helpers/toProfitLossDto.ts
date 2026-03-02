import { ISignalRow, IStrategyPnL } from "../interfaces/Strategy.interface";
import { GLOBAL_CONFIG } from "../config/params";
import { getEffectivePriceOpen } from "./getEffectivePriceOpen";

/**
 * Calculates profit/loss for a closed signal with slippage and fees.
 *
 * For signals with partial closes:
 * - Weights are calculated by ACTUAL DOLLAR VALUE of each partial relative to total invested.
 *   This correctly handles DCA entries that occur after partial closes.
 *
 * Weight formula per partial:
 *   partialDollarValue = (partial.percent / 100) × partial.positionCostBasisAtClose
 *   weight = partialDollarValue / totalInvested
 *   totalInvested = _entry.length × $100
 *
 * Remaining weight:
 *   closedDollarValue = Σ partialDollarValue_i
 *   remainingWeight = (totalInvested - closedDollarValue) / totalInvested
 *
 * Fee structure:
 *   - Open fee:  CC_PERCENT_FEE (charged once)
 *   - Close fee: CC_PERCENT_FEE × weight × (closeWithSlip / openWithSlip) per partial/remaining
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

    let closedDollarValue = 0;

    // Calculate PNL for each partial close
    for (const partial of signal._partial) {
      // Real dollar value sold in this partial
      // positionCostBasisAtClose = cost basis of position BEFORE this partial
      const positionCostBasisAtClose = partial.entryCountAtClose * 100;
      
      const partialDollarValue =
        (partial.percent / 100) * positionCostBasisAtClose;

      // Weight relative to total invested capital
      const weight = partialDollarValue / totalInvested;

      closedDollarValue += partialDollarValue;

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

    if (closedDollarValue > totalInvested + 0.001) {
      throw new Error(
        `Partial closes dollar value (${closedDollarValue.toFixed(4)}) exceeds total invested (${totalInvested}) — signal id: ${signal.id}`
      );
    }

    // Remaining position
    const remainingDollarValue = totalInvested - closedDollarValue;
    const remainingWeight = remainingDollarValue / totalInvested;

    if (remainingWeight > 0) {
      // Use current effective price — reflects all DCA including post-partial entries
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
