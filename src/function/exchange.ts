import backtest from "../lib/index";
import { CandleInterval, ICandleData } from "../interfaces/Exchange.interface";

const GET_CANDLES_METHOD_NAME = "exchange.getCandles";
const GET_AVERAGE_PRICE_METHOD_NAME = "exchange.getAveragePrice";
const FORMAT_PRICE_METHOD_NAME = "exchange.formatPrice";
const FORMAT_QUANTITY_METHOD_NAME = "exchange.formatQuantity";
const GET_DATE_METHOD_NAME = "exchange.getDate";
const GET_MODE_METHOD_NAME = "exchange.getMode";

export async function getCandles(
  symbol: string,
  interval: CandleInterval,
  limit: number
): Promise<ICandleData[]> {
  backtest.loggerService.info(GET_CANDLES_METHOD_NAME, {
    symbol,
    interval,
    limit,
  });
  return await backtest.exchangeConnectionService.getCandles(
    symbol,
    interval,
    limit
  );
}

export async function getAveragePrice(symbol: string): Promise<number> {
  backtest.loggerService.info(GET_AVERAGE_PRICE_METHOD_NAME, {
    symbol,
  });
  return await backtest.exchangeConnectionService.getAveragePrice(symbol);
}

export async function formatPrice(
  symbol: string,
  price: number
): Promise<string> {
  backtest.loggerService.info(FORMAT_PRICE_METHOD_NAME, {
    symbol,
    price,
  });
  return await backtest.exchangeConnectionService.formatPrice(symbol, price);
}

export async function formatQuantity(
  symbol: string,
  quantity: number
): Promise<string> {
  backtest.loggerService.info(FORMAT_QUANTITY_METHOD_NAME, {
    symbol,
    quantity,
  });
  return await backtest.exchangeConnectionService.formatQuantity(
    symbol,
    quantity
  );
}

export async function getDate() {
  backtest.loggerService.info(GET_DATE_METHOD_NAME);
  const { when } = backtest.executionContextService.context;
  return new Date(when.getTime());
}

export async function getMode() {
  backtest.loggerService.info(GET_MODE_METHOD_NAME);
  const { backtest: bt } = backtest.executionContextService.context;
  return bt ? "backtest" : "live";
}

export default { getCandles, getAveragePrice, getDate, getMode };
