import { addExchangeSchema, addFrameSchema, Exchange } from "./build/index.mjs";
import { singleshot } from "functools-kit";
import ccxt from "ccxt";

const getExchange = singleshot(async () => {
  const exchange = new ccxt.binance({
    options: {
      defaultType: "spot",
      adjustForTimeDifference: true,
      recvWindow: 60000,
    },
    enableRateLimit: true,
  });
  await exchange.loadMarkets();
  return exchange;
});

addExchangeSchema({
  exchangeName: "ccxt-exchange",
  getCandles: async (symbol, interval, since, limit) => {
    const exchange = await getExchange();
    const candles = await exchange.fetchOHLCV(
      symbol,
      interval,
      since.getTime(),
      limit,
    );
    return candles.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    }));
  },
});

addFrameSchema({
  frameName: "test-frame",
  interval: "1m",
  startDate: new Date("2025-10-01T00:00:00Z"),
  endDate: new Date("2025-10-31T23:59:59Z"),
  note: "Sharp market drop from the 9th to 11th",
});


console.log(
  await Exchange.getCandles("BTCUSDT", "1m", 5, {
    exchangeName: "ccxt-exchange",
  }),
);

