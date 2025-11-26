import { test } from "worker-testbed";

import {
  addExchange,
  addFrame,
  addStrategy,
  addRisk,
  Backtest,
  listenSignalBacktest,
  listenDoneBacktest,
} from "../../build/index.mjs";

import getMockCandles from "../mock/getMockCandles.mjs";
import { Subject } from "functools-kit";

test("Risk limits max concurrent positions during backtest", async ({ pass, fail }) => {

  let rejectedCount = 0;
  let allowedCount = 0;

  addExchange({
    exchangeName: "binance-integration-max-positions",
    getCandles: async (_symbol, interval, since, limit) => {
      return await getMockCandles(interval, since, limit);
    },
    formatPrice: async (symbol, price) => price.toFixed(8),
    formatQuantity: async (symbol, quantity) => quantity.toFixed(8),
  });

  addRisk({
    riskName: "max-3-positions",
    validations: [
      ({ activePositionCount }) => {
        if (activePositionCount >= 3) {
          throw new Error("Maximum 3 concurrent positions allowed");
        }
      },
    ],
    callbacks: {
      onRejected: () => {
        rejectedCount++;
      },
      onAllowed: () => {
        allowedCount++;
      },
    },
  });

  addStrategy({
    strategyName: "test-strategy-max-positions",
    interval: "1m",
    riskName: "max-3-positions",
    getSignal: async () => {
      return {
        position: "long",
        note: "max positions test",
        priceTakeProfit: 43000,
        priceStopLoss: 41000,
        minuteEstimatedTime: 60,
      };
    },
  });

  addFrame({
    frameName: "1d-max-positions",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-05T00:00:00Z"),
  });

  const awaitSubject = new Subject();
  listenDoneBacktest(() => awaitSubject.next());

  let closedCount = 0;
  listenSignalBacktest((result) => {
    if (result.symbol === "BTCUSDT" && result.action === "closed") {
      closedCount++;
    }
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-strategy-max-positions",
    exchangeName: "binance-integration-max-positions",
    frameName: "1d-max-positions",
  });

  await awaitSubject.toPromise();

  if (allowedCount === 3 && rejectedCount > 0 && closedCount === 3) {
    pass(`Risk correctly limited to 3 positions: ${allowedCount} allowed, ${rejectedCount} rejected, ${closedCount} closed`);
    return;
  }

  fail(`Expected 3 allowed, got ${allowedCount}; expected >0 rejected, got ${rejectedCount}; expected 3 closed, got ${closedCount}`);

});

test("Risk allows unlimited positions when no riskName specified", async ({ pass, fail }) => {

  addExchange({
    exchangeName: "binance-integration-no-risk",
    getCandles: async (_symbol, interval, since, limit) => {
      return await getMockCandles(interval, since, limit);
    },
    formatPrice: async (symbol, price) => price.toFixed(8),
    formatQuantity: async (symbol, quantity) => quantity.toFixed(8),
  });

  addStrategy({
    strategyName: "test-strategy-no-risk",
    interval: "1m",
    getSignal: async () => {
      return {
        position: "long",
        note: "no risk test",
        priceTakeProfit: 43000,
        priceStopLoss: 41000,
        minuteEstimatedTime: 60,
      };
    },
  });

  addFrame({
    frameName: "1d-no-risk",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-05T00:00:00Z"),
  });

  const awaitSubject = new Subject();
  listenDoneBacktest(() => awaitSubject.next());

  let signalCount = 0;
  listenSignalBacktest((result) => {
    if (result.symbol === "BTCUSDT" && result.action === "closed") {
      signalCount++;
    }
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-strategy-no-risk",
    exchangeName: "binance-integration-no-risk",
    frameName: "1d-no-risk",
  });

  await awaitSubject.toPromise();

  if (signalCount >= 5) {
    pass(`Strategy without riskName allowed ${signalCount} positions`);
    return;
  }

  fail(`Expected at least 5 positions, got ${signalCount}`);

});

test("Risk rejects signals based on custom symbol filter", async ({ pass, fail }) => {

  let btcRejected = false;
  let ethAllowed = false;

  addExchange({
    exchangeName: "binance-integration-symbol-filter",
    getCandles: async (_symbol, interval, since, limit) => {
      return await getMockCandles(interval, since, limit);
    },
    formatPrice: async (symbol, price) => price.toFixed(8),
    formatQuantity: async (symbol, quantity) => quantity.toFixed(8),
  });

  addRisk({
    riskName: "no-btc",
    validations: [
      ({ symbol }) => {
        if (symbol === "BTCUSDT") {
          throw new Error("BTC trading not allowed");
        }
      },
    ],
    callbacks: {
      onRejected: (symbol) => {
        if (symbol === "BTCUSDT") {
          btcRejected = true;
        }
      },
      onAllowed: (symbol) => {
        if (symbol === "ETHUSDT") {
          ethAllowed = true;
        }
      },
    },
  });

  addStrategy({
    strategyName: "test-strategy-symbol-filter",
    interval: "1m",
    riskName: "no-btc",
    getSignal: async () => {
      return {
        position: "long",
        note: "symbol filter test",
        priceTakeProfit: 43000,
        priceStopLoss: 41000,
        minuteEstimatedTime: 60,
      };
    },
  });

  addFrame({
    frameName: "1d-symbol-filter",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-02T00:00:00Z"),
  });

  const awaitSubjectBTC = new Subject();
  const awaitSubjectETH = new Subject();

  let backtestCount = 0;
  listenDoneBacktest(() => {
    backtestCount++;
    if (backtestCount === 1) {
      awaitSubjectBTC.next();
    } else if (backtestCount === 2) {
      awaitSubjectETH.next();
    }
  });

  let btcOpenedCount = 0;
  let ethOpenedCount = 0;

  listenSignalBacktest((result) => {
    if (result.symbol === "BTCUSDT" && result.action === "opened") {
      btcOpenedCount++;
    }
    if (result.symbol === "ETHUSDT" && result.action === "opened") {
      ethOpenedCount++;
    }
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-strategy-symbol-filter",
    exchangeName: "binance-integration-symbol-filter",
    frameName: "1d-symbol-filter",
  });

  await awaitSubjectBTC.toPromise();

  Backtest.background("ETHUSDT", {
    strategyName: "test-strategy-symbol-filter",
    exchangeName: "binance-integration-symbol-filter",
    frameName: "1d-symbol-filter",
  });

  await awaitSubjectETH.toPromise();

  if (btcRejected && btcOpenedCount === 0 && ethAllowed && ethOpenedCount > 0) {
    pass(`Risk correctly filtered symbols: BTC rejected (0 opened), ETH allowed (${ethOpenedCount} opened)`);
    return;
  }

  fail(`BTC rejected: ${btcRejected}, BTC opened: ${btcOpenedCount}, ETH allowed: ${ethAllowed}, ETH opened: ${ethOpenedCount}`);

});

test("Risk tracks activePositionCount correctly across signal lifecycle", async ({ pass, fail }) => {

  const positionCounts = [];

  addExchange({
    exchangeName: "binance-integration-position-tracking",
    getCandles: async (_symbol, interval, since, limit) => {
      return await getMockCandles(interval, since, limit);
    },
    formatPrice: async (symbol, price) => price.toFixed(8),
    formatQuantity: async (symbol, quantity) => quantity.toFixed(8),
  });

  addRisk({
    riskName: "track-positions",
    validations: [
      ({ activePositionCount }) => {
        positionCounts.push(activePositionCount);
      },
    ],
  });

  addStrategy({
    strategyName: "test-strategy-position-tracking",
    interval: "1m",
    riskName: "track-positions",
    getSignal: async () => {
      return {
        position: "long",
        note: "position tracking test",
        priceTakeProfit: 43000,
        priceStopLoss: 41000,
        minuteEstimatedTime: 120,
      };
    },
  });

  addFrame({
    frameName: "1d-position-tracking",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-10T00:00:00Z"),
  });

  const awaitSubject = new Subject();
  listenDoneBacktest(() => awaitSubject.next());

  let closedCount = 0;
  listenSignalBacktest((result) => {
    if (result.symbol === "BTCUSDT" && result.action === "closed") {
      closedCount++;
    }
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-strategy-position-tracking",
    exchangeName: "binance-integration-position-tracking",
    frameName: "1d-position-tracking",
  });

  await awaitSubject.toPromise();

  const hasZero = positionCounts.includes(0);
  const hasOne = positionCounts.includes(1);

  if (hasZero && hasOne && positionCounts.length >= 3) {
    pass(`Risk tracked position counts correctly: ${JSON.stringify(positionCounts.slice(0, 10))}`);
    return;
  }

  fail(`Position counts not tracked correctly: ${JSON.stringify(positionCounts)}`);

});

test("Multiple strategies share same risk profile", async ({ pass, fail }) => {

  let totalRejected = 0;
  let strategy1Allowed = 0;
  let strategy2Allowed = 0;

  addExchange({
    exchangeName: "binance-integration-shared-risk",
    getCandles: async (_symbol, interval, since, limit) => {
      return await getMockCandles(interval, since, limit);
    },
    formatPrice: async (symbol, price) => price.toFixed(8),
    formatQuantity: async (symbol, quantity) => quantity.toFixed(8),
  });

  addRisk({
    riskName: "shared-max-2",
    validations: [
      ({ activePositionCount }) => {
        if (activePositionCount >= 2) {
          throw new Error("Maximum 2 concurrent positions across all strategies");
        }
      },
    ],
    callbacks: {
      onRejected: () => {
        totalRejected++;
      },
      onAllowed: (symbol, params) => {
        if (params.strategyName === "shared-strategy-1") {
          strategy1Allowed++;
        }
        if (params.strategyName === "shared-strategy-2") {
          strategy2Allowed++;
        }
      },
    },
  });

  addStrategy({
    strategyName: "shared-strategy-1",
    interval: "1m",
    riskName: "shared-max-2",
    getSignal: async () => {
      return {
        position: "long",
        note: "shared risk test 1",
        priceTakeProfit: 43000,
        priceStopLoss: 41000,
        minuteEstimatedTime: 120,
      };
    },
  });

  addStrategy({
    strategyName: "shared-strategy-2",
    interval: "1m",
    riskName: "shared-max-2",
    getSignal: async () => {
      return {
        position: "short",
        note: "shared risk test 2",
        priceTakeProfit: 41000,
        priceStopLoss: 43000,
        minuteEstimatedTime: 120,
      };
    },
  });

  addFrame({
    frameName: "1d-shared-risk",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-10T00:00:00Z"),
  });

  const awaitSubject1 = new Subject();
  const awaitSubject2 = new Subject();

  let backtestDoneCount = 0;
  listenDoneBacktest(() => {
    backtestDoneCount++;
    if (backtestDoneCount === 1) {
      awaitSubject1.next();
    } else if (backtestDoneCount === 2) {
      awaitSubject2.next();
    }
  });

  let strategy1Closed = 0;
  let strategy2Closed = 0;

  listenSignalBacktest((result) => {
    if (result.strategyName === "shared-strategy-1" && result.action === "closed") {
      strategy1Closed++;
    }
    if (result.strategyName === "shared-strategy-2" && result.action === "closed") {
      strategy2Closed++;
    }
  });

  Backtest.background("BTCUSDT", {
    strategyName: "shared-strategy-1",
    exchangeName: "binance-integration-shared-risk",
    frameName: "1d-shared-risk",
  });

  Backtest.background("BTCUSDT", {
    strategyName: "shared-strategy-2",
    exchangeName: "binance-integration-shared-risk",
    frameName: "1d-shared-risk",
  });

  await Promise.all([awaitSubject1.toPromise(), awaitSubject2.toPromise()]);

  const totalAllowed = strategy1Allowed + strategy2Allowed;

  if (totalAllowed <= 2 && totalRejected > 0 && strategy1Closed >= 1 && strategy2Closed >= 1) {
    pass(`Shared risk profile limited both strategies: ${totalAllowed} total allowed (${strategy1Allowed} + ${strategy2Allowed}), ${totalRejected} rejected`);
    return;
  }

  fail(`Expected <=2 total allowed, got ${totalAllowed}; expected >0 rejected, got ${totalRejected}`);

});

test("Risk validation with price-based logic", async ({ pass, fail }) => {

  let lowPriceRejected = 0;
  let highPriceAllowed = 0;

  addExchange({
    exchangeName: "binance-integration-price-filter",
    getCandles: async (_symbol, interval, since, limit) => {
      return await getMockCandles(interval, since, limit);
    },
    formatPrice: async (symbol, price) => price.toFixed(8),
    formatQuantity: async (symbol, quantity) => quantity.toFixed(8),
  });

  addRisk({
    riskName: "min-price-filter",
    validations: [
      ({ currentPrice }) => {
        if (currentPrice < 40000) {
          throw new Error("Price too low for trading");
        }
      },
    ],
    callbacks: {
      onRejected: () => {
        lowPriceRejected++;
      },
      onAllowed: () => {
        highPriceAllowed++;
      },
    },
  });

  addStrategy({
    strategyName: "test-strategy-price-filter",
    interval: "1m",
    riskName: "min-price-filter",
    getSignal: async () => {
      return {
        position: "long",
        note: "price filter test",
        priceTakeProfit: 43000,
        priceStopLoss: 41000,
        minuteEstimatedTime: 60,
      };
    },
  });

  addFrame({
    frameName: "1d-price-filter",
    interval: "1d",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-02T00:00:00Z"),
  });

  const awaitSubject = new Subject();
  listenDoneBacktest(() => awaitSubject.next());

  let openedCount = 0;
  listenSignalBacktest((result) => {
    if (result.symbol === "BTCUSDT" && result.action === "opened") {
      openedCount++;
    }
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-strategy-price-filter",
    exchangeName: "binance-integration-price-filter",
    frameName: "1d-price-filter",
  });

  await awaitSubject.toPromise();

  if (highPriceAllowed > 0 && openedCount > 0) {
    pass(`Price-based risk validation works: ${highPriceAllowed} allowed at high price, ${lowPriceRejected} rejected at low price`);
    return;
  }

  fail(`Expected >0 high price allowed, got ${highPriceAllowed}; opened: ${openedCount}`);

});
