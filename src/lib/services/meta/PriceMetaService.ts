import { inject } from "../../../lib/core/di";
import LoggerService from "../base/LoggerService";
import TYPES from "../../../lib/core/types";
import { StrategyName } from "../../../interfaces/Strategy.interface";
import { ExchangeName } from "../../../interfaces/Exchange.interface";
import { FrameName } from "../../../interfaces/Frame.interface";
import { BehaviorSubject, memoize, waitForNext } from "functools-kit";
import ExecutionContextService, {
  TExecutionContextService,
} from "../context/ExecutionContextService";
import MethodContextService from "../context/MethodContextService";
import ExchangeConnectionService from "../connection/ExchangeConnectionService";

const LISTEN_TIMEOUT = 120_000;

const CREATE_KEY_FN = (
  symbol: string,
  strategyName: StrategyName,
  exchangeName: ExchangeName,
  frameName: FrameName,
  backtest: boolean,
): string => {
  const parts = [symbol, strategyName, exchangeName];
  if (frameName) parts.push(frameName);
  parts.push(backtest ? "backtest" : "live");
  return parts.join(":");
};

type KeyFn = (
  symbol: string,
  strategyName: string,
  exchangeName: string,
  frameName: string,
  backtest: boolean,
) => BehaviorSubject<number>;

export class PriceMetaService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  private readonly exchangeConnectionService = inject<ExchangeConnectionService>(
    TYPES.exchangeConnectionService,
  );

  private getSource = memoize<KeyFn>(
    ([symbol, strategyName, exchangeName, frameName, backtest]) =>
      CREATE_KEY_FN(symbol, strategyName, exchangeName, frameName, backtest),
    () => new BehaviorSubject<number>(),
  );

  public getCurrentPrice = async (
    symbol: string,
    context: {
      strategyName: string;
      exchangeName: string;
      frameName: string;
    },
    backtest: boolean,
  ) => {
    this.loggerService.log("priceMetaService getCurrentPrice", {
      symbol,
      context,
      backtest,
    });
    if (
      ExecutionContextService.hasContext() &&
      MethodContextService.hasContext()
    ) {
      return await this.exchangeConnectionService.getAveragePrice(symbol);
    }
    const source = this.getSource(
      symbol,
      context.strategyName,
      context.exchangeName,
      context.frameName,
      backtest,
    );
    if (source.data) {
      return source.data;
    }
    console.warn(
      `PriceMetaService: No currentPrice available for ${CREATE_KEY_FN(symbol, context.strategyName, context.exchangeName, context.frameName, backtest)}. Trying to fetch from strategy iterator as a fallback...`,
    );
    const currentPrice = await waitForNext<number>(
      source,
      (data) => !!data,
      LISTEN_TIMEOUT,
    );
    if (typeof currentPrice === "symbol") {
      throw new Error(
        `PriceMetaService: Timeout while waiting for currentPrice for ${CREATE_KEY_FN(symbol, context.strategyName, context.exchangeName, context.frameName, backtest)}`,
      );
    }
    return currentPrice;
  };

  public next = async (
    symbol: string,
    currentPrice: number,
    context: {
      strategyName: string;
      exchangeName: string;
      frameName: string;
    },
    backtest: boolean,
  ) => {
    this.loggerService.log("priceMetaService next", {
      symbol,
      currentPrice,
      context,
      backtest,
    });
    const source = this.getSource(
      symbol,
      context.strategyName,
      context.exchangeName,
      context.frameName,
      backtest,
    );
    source.next(currentPrice);
  };

  public clear = (
    payload?: {
      symbol: string,
      strategyName: string;
      exchangeName: string;
      frameName: string;
      backtest: boolean,
    }
  ) => {
    this.loggerService.log("priceMetaService clear", {
      payload
    });
    if (!payload) {
      this.getSource.clear();
      return;
    }
    const key = CREATE_KEY_FN(
      payload.symbol,
      payload.strategyName,
      payload.exchangeName,
      payload.frameName,
      payload.backtest,
    );
    this.getSource.clear(key);
  };
}

export default PriceMetaService;
