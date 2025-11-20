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

export default { getCandles, getAveragePrice };
