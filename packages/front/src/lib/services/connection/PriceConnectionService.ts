import { listenSignal } from "backtest-kit";
import {
  BehaviorSubject,
  memoize,
  singleshot,
  waitForNext,
} from "functools-kit";
import { inject } from "src/lib/core/di";
import LoggerService from "../base/LoggerService";
import { TYPES } from "src/lib/core/types";

type ExchangeName = string;
type FrameName = string;

const PRICE_TIMEOUT = 120_000;

const CREATE_KEY_FN = (
  symbol: string,
  exchangeName: ExchangeName,
  frameName: FrameName,
  backtest: boolean,
): string => {
  const parts = [symbol, exchangeName];
  if (frameName) parts.push(frameName);
  parts.push(backtest ? "backtest" : "live");
  return parts.join(":");
};

const GET_SUBJECT_FN = memoize<
  (
    symbol: string,
    exchangeName: ExchangeName,
    frameName: FrameName,
    backtest: boolean,
  ) => BehaviorSubject<number>
>(
  ([symbol, exchangeName, frameName, backtest]) =>
    CREATE_KEY_FN(symbol, exchangeName, frameName, backtest),
  () => new BehaviorSubject<number>(),
);

const GET_PRICE_FN = async (
  symbol: string,
  exchangeName: ExchangeName,
  frameName: FrameName,
  backtest: boolean,
) => {
  const priceSubject = GET_SUBJECT_FN(
    symbol,
    exchangeName,
    frameName,
    backtest,
  );
  if (priceSubject.data) {
    return priceSubject.data;
  }
  return await waitForNext<number>(
    priceSubject,
    (data) => !!data,
    PRICE_TIMEOUT,
  );
};

export class PriceConnectionService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getCurrentPrice = async (
    symbol: string,
    exchangeName: ExchangeName,
    frameName: FrameName,
    backtest: boolean,
  ) => {
    this.loggerService.log("priceConnectionService getCurrentPrice", {
      symbol,
      exchangeName,
      frameName,
      backtest,
    });
    const currentPrice = await GET_PRICE_FN(
      symbol,
      exchangeName,
      frameName,
      backtest,
    );
    if (typeof currentPrice === "symbol") {
      throw new Error(
        `Price for ${CREATE_KEY_FN(symbol, exchangeName, frameName, backtest)} not received within timeout`,
      );
    }
    return currentPrice;
  };

  protected init = singleshot(async () => {
    this.loggerService.log("priceConnectionService init");
    listenSignal((event) => {
      const priceSubject = GET_SUBJECT_FN(
        event.symbol,
        event.exchangeName,
        event.frameName,
        event.backtest,
      );
      event.currentPrice && priceSubject.next(event.currentPrice);
    });
  });
}

export default PriceConnectionService;
