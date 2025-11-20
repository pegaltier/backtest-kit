import backtest from "../lib/index";
import { CandleInterval, ICandleData } from "../interfaces/Candle.interface";

export async function getCandles(
  symbol: string,
  interval: CandleInterval,
  limit: number
): Promise<ICandleData[]> {
  return await backtest.candleConnectionService.getCandles(
    symbol,
    interval,
    limit
  );
}

export async function getAveragePrice(symbol: string): Promise<number> {
  return await backtest.candleConnectionService.getAveragePrice(symbol);
}

export default { getCandles, getAveragePrice };
