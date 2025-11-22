import { test } from "worker-testbed";

import {
  addExchange,
  addFrame,
  addStrategy,
  Backtest,
  listenSignalBacktest,
} from "../../build/index.mjs";

import getMockCandles from "../mock/getMockCandles.mjs";
import { createAwaiter } from "functools-kit";

test("PNL is being calculated", async ({ pass, fail }) => {

  const [awaiter, { resolve }] = createAwaiter();

  addExchange({
    exchangeName: "binance-mock-costs",
    getCandles: async (_symbol, interval, since, limit) => {
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
    strategyName: "test-strategy-costs",
    interval: "1m",
    getSignal: async () => {
      return {
        position: "long",
        note: "costs verification",
        priceOpen: 10000,
        priceTakeProfit: 10100,
        priceStopLoss: 9900,
        minuteEstimatedTime: 60,
      };
    },
  });

  addFrame({
    frameName: "1d-backtest-costs",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-02T00:00:00Z"),
  });

  const unsubscribe = listenSignalBacktest((event) => {
    if (event.action === "closed") {
      resolve(event.pnl);
      unsubscribe();
    }
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-strategy-costs",
    exchangeName: "binance-mock-costs",
    frameName: "1d-backtest-costs",
  });

  const pnl = await awaiter;

  if (pnl) {
    pass(`PNL was calculated: ${pnl.pnlPercentage.toFixed(2)}%`);
    return;
  }

  fail("PNL was not calculated");

});
