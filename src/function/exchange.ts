import backtest from "../lib/index";
import { CandleInterval, ICandleData } from "../interfaces/Exchange.interface";

export async function getCandles(
  symbol: string,
  interval: CandleInterval,
  limit: number
): Promise<ICandleData[]> {
  return await backtest.exchangeConnectionService.getCandles(
    symbol,
    interval,
    limit
  );
}

export async function getAveragePrice(symbol: string): Promise<number> {
  return await backtest.exchangeConnectionService.getAveragePrice(symbol);
}

export async function formatPrice(
  symbol: string,
  price: number
): Promise<string> {
  return await backtest.exchangeConnectionService.formatPrice(symbol, price);
}

export async function formatQuantity(
  symbol: string,
  quantity: number
): Promise<string> {
  return await backtest.exchangeConnectionService.formatQuantity(
    symbol,
    quantity
  );
}

export default { getCandles, getAveragePrice };
