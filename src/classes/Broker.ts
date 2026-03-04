// todo: wrap commit* and signalSync to exchange query before state mutation
// Broker.useAdapter
// Broker.commitPartialProfit/Broker.commitAverageBuy on public api layer before DI query

import { ExchangeName } from "../interfaces/Exchange.interface";
import { FrameName } from "../interfaces/Frame.interface";
import { StrategyName } from "../interfaces/Strategy.interface";

// Should listen syncSubject automatically cause the new signal is triggered by backtest-kit not the user

export type BrokerPartialProfitPayload = {
  symbol: string;
  percentToClose: number;
  cost: number;
  currentPrice: number;
  context: {
    strategyName: StrategyName;
    exchangeName: ExchangeName;
    frameName?: FrameName;
  };
  backtest: boolean;
};

export type BrokerPartialLossPayload = {
  symbol: string;
  percentToClose: number;
  cost: number;
  currentPrice: number;
  context: {
    strategyName: StrategyName;
    exchangeName: ExchangeName;
    frameName?: FrameName;
  };
  backtest: boolean;
};

export type BrokerTrailingStopPayload = {
  symbol: string;
  percentShift: number;
  currentPrice: number;
  newStopLossPrice: number;
  context: {
    strategyName: StrategyName;
    exchangeName: ExchangeName;
    frameName?: FrameName;
  };
  backtest: boolean;
};

export type BrokerTrailingTakePayload = {
  symbol: string;
  percentShift: number;
  currentPrice: number;
  newTakeProfitPrice: number;
  context: {
    strategyName: StrategyName;
    exchangeName: ExchangeName;
    frameName?: FrameName;
  };
  backtest: boolean;
};

export type BrokerBreakevenPayload = {
  symbol: string;
  currentPrice: number;
  context: {
    strategyName: StrategyName;
    exchangeName: ExchangeName;
    frameName?: FrameName;
  };
  backtest: boolean;
};

export type BrokerAverageBuyPayload = {
  symbol: string;
  currentPrice: number;
  cost: number;
  context: {
    strategyName: StrategyName;
    exchangeName: ExchangeName;
    frameName?: FrameName;
  };
  backtest: boolean;
};

export class BrokerAdapter {
  public commitPartialProfit = async (payload: BrokerPartialProfitPayload) => {
    if (payload.backtest) {
      return;
    }
  };

  public commitPartialLoss = async (payload: BrokerPartialLossPayload) => {
    if (payload.backtest) {
      return;
    }
  };

  public commitTrailingStop = async (payload: BrokerTrailingStopPayload) => {
    if (payload.backtest) {
      return;
    }
  };

  public commitTrailingTake = async (payload: BrokerTrailingTakePayload) => {
    if (payload.backtest) {
      return;
    }
  };

  public commitBreakeven = async (payload: BrokerBreakevenPayload) => {
    if (payload.backtest) {
      return;
    }
  };

  public commitAverageBuy = async (payload: BrokerAverageBuyPayload) => {
    if (payload.backtest) {
      return;
    }
  };
}

export const Broker = new BrokerAdapter();
