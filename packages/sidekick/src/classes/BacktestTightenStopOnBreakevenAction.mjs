import { ActionBase, commitTrailingStop } from "backtest-kit";

/**
 * Tightens trailing-stop by 3% when breakeven is reached
 */
export class BacktestTightenStopOnBreakevenAction extends ActionBase {
  async breakevenAvailable({ symbol, currentPrice }) {
    // Tighten trailing-stop by 3% (negative value brings stop-loss closer to entry)
    await commitTrailingStop(symbol, -3, currentPrice);
  }
}

export default BacktestTightenStopOnBreakevenAction;
