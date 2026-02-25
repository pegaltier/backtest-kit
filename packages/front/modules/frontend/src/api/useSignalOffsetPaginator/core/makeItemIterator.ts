import { IStorageSignalRow } from "backtest-kit";
import ioc from "../../../lib";
import { ISignal } from "../model/Signal.model";

type ClosedSignal = Extract<IStorageSignalRow, { status: "closed" }>;

const makeItemIterator =
  (mode: "live" | "backtest") => async (): Promise<ISignal[]> => {
    const all =
      mode === "live"
        ? await ioc.storageViewService.listSignalLive()
        : await ioc.storageViewService.listSignalBacktest();

    return all
      .filter((s): s is ClosedSignal => s.status === "closed")
      .map(
        (s): ISignal => ({
          id: s.id,
          symbol: s.symbol,
          position: s.position,
          profitLoss: s.pnl.pnlPercentage,
          profitLossPercentage: s.pnl.pnlPercentage,
          buyPrice: s.pnl.priceOpen,
          quantity: 0,
          date: new Date(s.createdAt).toISOString(),
          status: "finished",
        })
      );
  };

export default makeItemIterator;
