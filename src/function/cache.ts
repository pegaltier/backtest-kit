import backtest from "../lib";
import { ExchangeInstance } from "../classes/Exchange";
import { GLOBAL_CONFIG } from "../config/params";
import { ExchangeName, CandleInterval } from "../interfaces/Exchange.interface";

const WARM_CANDLES_METHOD_NAME = "cache.warmCandles";

const MS_PER_MINUTE = 60_000;

const INTERVAL_MINUTES: Record<CandleInterval, number> = {
  "1m": 1,
  "3m": 3,
  "5m": 5,
  "15m": 15,
  "30m": 30,
  "1h": 60,
  "2h": 120,
  "4h": 240,
  "6h": 360,
  "8h": 480,
};

const ALIGN_TO_INTERVAL_FN = (
  timestamp: number,
  intervalMinutes: number,
): number => {
  const intervalMs = intervalMinutes * MS_PER_MINUTE;
  return Math.floor(timestamp / intervalMs) * intervalMs;
};

const BAR_LENGTH = 30;
const BAR_FILLED_CHAR = "\u2588";
const BAR_EMPTY_CHAR = "\u2591";

const PRINT_PROGRESS_FN = (
  fetched: number,
  total: number,
  symbol: string,
  interval: CandleInterval,
) => {
  const percent = Math.round((fetched / total) * 100);
  const filled = Math.round((fetched / total) * BAR_LENGTH);
  const empty = BAR_LENGTH - filled;
  const bar = BAR_FILLED_CHAR.repeat(filled) + BAR_EMPTY_CHAR.repeat(empty);
  process.stdout.write(
    `\r[${bar}] ${percent}% (${fetched}/${total}) ${symbol} ${interval}`,
  );
  if (fetched === total) {
    process.stdout.write("\n");
  }
};

/**
 * Parameters for pre-caching candles into persist storage.
 * Used to download historical candle data before running a backtest.
 */
export interface ICacheCandlesParams {
  /** Trading pair symbol (e.g., "BTCUSDT") */
  symbol: string;
  /** Name of the registered exchange schema */
  exchangeName: ExchangeName;
  /** Candle time interval (e.g., "1m", "4h") */
  interval: CandleInterval;
  /** Start date of the caching range (inclusive) */
  from: Date;
  /** End date of the caching range (inclusive) */
  to: Date;
}

/**
 * Pre-caches candles for a date range into persist storage.
 * Downloads all candles matching the interval from `from` to `to`.
 *
 * @param params - Cache parameters
 */
export async function warmCandles(params: ICacheCandlesParams): Promise<void> {
  const { symbol, exchangeName, interval, from, to } = params;

  backtest.loggerService.info(WARM_CANDLES_METHOD_NAME, {
    symbol,
    exchangeName,
    interval,
    from,
    to,
  });

  const step = INTERVAL_MINUTES[interval];

  if (!step) {
    throw new Error(
      `warmCandles: unsupported interval=${interval}`,
    );
  }

  const stepMs = step * MS_PER_MINUTE;
  const instance = new ExchangeInstance(exchangeName);

  const sinceTimestamp = ALIGN_TO_INTERVAL_FN(from.getTime(), step);
  const untilTimestamp = ALIGN_TO_INTERVAL_FN(to.getTime(), step);
  const totalCandles = Math.ceil((untilTimestamp - sinceTimestamp) / stepMs);

  if (totalCandles <= 0) {
    throw new Error(
      `warmCandles: no candles to cache (from >= to after alignment)`,
    );
  }

  let fetched = 0;
  let currentSince = sinceTimestamp;

  PRINT_PROGRESS_FN(fetched, totalCandles, symbol, interval);

  while (fetched < totalCandles) {
    const chunkLimit = Math.min(
      totalCandles - fetched,
      GLOBAL_CONFIG.CC_MAX_CANDLES_PER_REQUEST,
    );
    await instance.getRawCandles(symbol, interval, chunkLimit, currentSince);
    fetched += chunkLimit;
    currentSince += chunkLimit * stepMs;
    PRINT_PROGRESS_FN(fetched, totalCandles, symbol, interval);
  }
}
