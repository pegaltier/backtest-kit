import { test } from "tape";

import {
  addExchange,
  addFrame,
  addStrategy,
  Backtest,
  getCandles,
} from "../../build/index.mjs";

import getMockCandles from "../mock/getMockCandles.mjs";
import { createAwaiter } from "functools-kit";

test("getCandles returns correct candle data", async ({ pass, fail }) => {

  const [awaiter, { resolve }] = createAwaiter();

  addExchange({
    exchangeName: "binance-mock",
    getCandles: async (_symbol, interval, since, limit) => {
      // Generate mock candles dynamically based on interval, since and limit
      return await getMockCandles(interval, since, limit);
    },
    formatPrice: async (symbol, price) => {
      return price.toFixed(8);
    },
    formatQuantity: async (symbol, quantity) => {
      return quantity.toFixed(8);
    },
  });

  addStrategy({
    strategyName: "test-strategy",
    interval: "1m",
    getSignal: async () => {
      resolve(getCandles("BTCUSDT", "1h", 5));
      return null; // Don't generate signals
    },
  });

  addFrame({
    frameName: "1d-backtest",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-02T00:00:00Z"),
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-strategy",
    exchangeName: "binance-mock",
    frameName: "1d-backtest",
  });

  const lastCandles = await awaiter;

  if (lastCandles !== null) {
    pass("Candles are fetched");
    return;
  }

  fail("Candles not fetched");

});
