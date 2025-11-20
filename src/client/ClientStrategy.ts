import { randomString } from "functools-kit";
import {
  IStrategy,
  ISignalRow,
  ISignalDto,
  IStrategyParams,
  IStrategyPnL,
  IStrategyTickResult,
  StrategyCloseReason,
} from "../interfaces/Strategy.interface";
import toProfitLossDto from "src/helpers/toProfitLossDto";

const GET_SIGNAL_FN = async (self: ClientStrategy) => {
  const signal = await self.params.getSignal(
    self.params.execution.context.symbol
  );
  if (!signal) {
    return null;
  }
  return {
    ...signal,
    id: randomString(),
  };
};

export class ClientStrategy implements IStrategy {
  _pendingSignal: ISignalRow | null = null;

  constructor(readonly params: IStrategyParams) {}

  public tick = async (): Promise<IStrategyTickResult> => {
    this.params.logger.debug("ClientStrategy tick");

    if (!this._pendingSignal) {
      this._pendingSignal = await GET_SIGNAL_FN(this);

      if (this._pendingSignal) {
        if (this.params.callbacks?.onOpen) {
          this.params.callbacks.onOpen(
            this.params.execution.context.backtest,
            this.params.execution.context.symbol,
            this._pendingSignal
          );
        }

        return {
          action: "opened",
          signal: this._pendingSignal,
        };
      }

      return {
        action: "idle",
        signal: null,
      };
    }

    const when = this.params.execution.context.when;
    const signal = this._pendingSignal;

    // Получаем среднюю цену
    const averagePrice = await this.params.exchange.getAveragePrice(
      this.params.execution.context.symbol
    );

    this.params.logger.debug("ClientStrategy tick check", {
      symbol: this.params.execution.context.symbol,
      averagePrice,
      signalId: signal.id,
      position: signal.position,
    });

    let shouldClose = false;
    let closeReason: StrategyCloseReason | undefined;

    // Проверяем истечение времени
    const signalEndTime =
      signal.timestamp + signal.minuteEstimatedTime * 60 * 1000;
    if (when.getTime() >= signalEndTime) {
      shouldClose = true;
      closeReason = "time_expired";
    }

    // Проверяем достижение TP/SL для long позиции
    if (signal.position === "long") {
      if (averagePrice >= signal.priceTakeProfit) {
        shouldClose = true;
        closeReason = "take_profit";
      } else if (averagePrice <= signal.priceStopLoss) {
        shouldClose = true;
        closeReason = "stop_loss";
      }
    }

    // Проверяем достижение TP/SL для short позиции
    if (signal.position === "short") {
      if (averagePrice <= signal.priceTakeProfit) {
        shouldClose = true;
        closeReason = "take_profit";
      } else if (averagePrice >= signal.priceStopLoss) {
        shouldClose = true;
        closeReason = "stop_loss";
      }
    }

    // Закрываем сигнал если выполнены условия
    if (shouldClose) {
      const pnl = toProfitLossDto(signal, averagePrice);

      this.params.logger.debug("ClientStrategy closing", {
        symbol: this.params.execution.context.symbol,
        signalId: signal.id,
        reason: closeReason,
        priceClose: averagePrice,
        pnlPercentage: pnl.pnlPercentage,
      });

      if (this.params.callbacks?.onClose) {
        this.params.callbacks.onClose(
          this.params.execution.context.backtest,
          this.params.execution.context.symbol,
          averagePrice,
          signal
        );
      }

      this._pendingSignal = null;

      return {
        action: "closed",
        signal: signal,
        currentPrice: averagePrice,
        closeReason: closeReason,
        pnl: pnl,
      };
    }

    return {
      action: "active",
      signal: signal,
      currentPrice: averagePrice,
    };
  };
}

export default ClientStrategy;
