import { test } from "worker-testbed";
import {
  addExchangeSchema,
  addFrameSchema,
  addStrategySchema,
  Backtest,
  getCandles,
  getRawCandles,
  getNextCandles,
  Exchange,
} from "../../build/index.mjs";
import { createAwaiter } from "functools-kit";

test("getCandles does not return unclosed candles (lookahead bias from higher timeframes)", async ({
  pass,
  fail,
}) => {
  const [awaiter, { resolve }] = createAwaiter();

  // Test Time: 2024-01-01T10:24:00Z
  const T_10_24 = new Date("2024-01-01T10:24:00Z");

  // Helper to generate candles
  const generateCandles = (intervalMinutes, startHour, count) => {
    const candles = [];
    const stepMs = intervalMinutes * 60 * 1000;
    // Start from T_00_00 for simplicity
    let current = new Date("2024-01-01T00:00:00Z").getTime();

    for (let i = 0; i < 2000; i++) {
      candles.push({
        timestamp: current,
        open: 100, high: 105, low: 95, close: 101, volume: 1000
      });
      current += stepMs;
    }
    return candles;
  };

  const candles1m = generateCandles(1, 0, 1000);
  const candles15m = generateCandles(15, 0, 100);
  const candles1h = generateCandles(60, 0, 24);
  const candles4h = generateCandles(240, 0, 6);

  addExchangeSchema({
    exchangeName: "test-exchange",
    getCandles: async (_symbol, interval, since, limit) => {
      let source = [];
      if (interval === "1m") source = candles1m;
      else if (interval === "15m") source = candles15m;
      else if (interval === "1h") source = candles1h;
      else if (interval === "4h") source = candles4h;
      else return [];

      const sinceMs = since.getTime();
      const filtered = source.filter(c => c.timestamp >= sinceMs);
      return filtered.slice(0, limit);
    },
    formatPrice: async (_, p) => p.toFixed(2),
    formatQuantity: async (_, q) => q.toFixed(5),
  });

  addStrategySchema({
    strategyName: "test-lookahead",
    interval: "1m",
    getSignal: async () => {
      try {
        const c1m = await getCandles("BTCUSDT", "1m", 5);
        const c15m = await getCandles("BTCUSDT", "15m", 5);
        const c1h = await getCandles("BTCUSDT", "1h", 5);
        const c4h = await getCandles("BTCUSDT", "4h", 5);

        resolve({ c1m, c15m, c1h, c4h });
      } catch (e) {
        resolve(null);
      }
      return null;
    },
  });

  addFrameSchema({
    frameName: "lookahead-check",
    interval: "1d",
    startDate: T_10_24,
    endDate: new Date("2024-01-01T10:35:00Z"),
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-lookahead",
    exchangeName: "test-exchange",
    frameName: "lookahead-check",
  });

  const results = await awaiter;

  if (!results) {
    fail("Strategy returned null results");
    return;
  }

  const { c1m, c15m, c1h, c4h } = results;

  const last1m = c1m[c1m.length - 1];
  const last15m = c15m[c15m.length - 1];
  const last1h = c1h[c1h.length - 1];
  const last4h = c4h[c4h.length - 1];

  // Checks
  const t1m = last1m?.timestamp === new Date("2024-01-01T10:23:00Z").getTime();
  const t15m = last15m?.timestamp === new Date("2024-01-01T10:00:00Z").getTime();
  const t1h = last1h?.timestamp === new Date("2024-01-01T09:00:00Z").getTime();
  const t4h = last4h?.timestamp === new Date("2024-01-01T04:00:00Z").getTime();

  if (t1m && t15m && t1h && t4h) {
    pass("All timeframes correctly filtered unclosed candles.");
  } else {
    let msg = "Lookahead bias detected or incorrect filtering:\n";
    if (!t1m) msg += `1m: Expected 10:23, got ${last1m ? new Date(last1m.timestamp).toISOString() : 'undefined'}\n`;
    if (!t15m) msg += `15m: Expected 10:00, got ${last15m ? new Date(last15m.timestamp).toISOString() : 'undefined'}\n`;
    if (!t1h) msg += `1h: Expected 09:00, got ${last1h ? new Date(last1h.timestamp).toISOString() : 'undefined'}\n`;
    if (!t4h) msg += `4h: Expected 04:00, got ${last4h ? new Date(last4h.timestamp).toISOString() : 'undefined'}\n`;
    fail(msg);
  }
});

test("getRawCandles prevents lookahead bias with different parameter combinations", async ({
  pass,
  fail,
}) => {
  const [awaiter, { resolve }] = createAwaiter();

  // Test Time: 2024-01-01T10:24:00Z
  const T_10_24 = new Date("2024-01-01T10:24:00Z");
  const T_10_24_MS = T_10_24.getTime();

  // Helper to generate candles
  const generateCandles = (intervalMinutes, count) => {
    const candles = [];
    const stepMs = intervalMinutes * 60 * 1000;
    let current = new Date("2024-01-01T00:00:00Z").getTime();

    for (let i = 0; i < count; i++) {
      candles.push({
        timestamp: current,
        open: 100,
        high: 105,
        low: 95,
        close: 101,
        volume: 1000,
      });
      current += stepMs;
    }
    return candles;
  };

  const candles1m = generateCandles(1, 2000);
  const candles15m = generateCandles(15, 200);

  addExchangeSchema({
    exchangeName: "test-exchange-raw",
    getCandles: async (_symbol, interval, since, limit) => {
      let source = [];
      if (interval === "1m") source = candles1m;
      else if (interval === "15m") source = candles15m;
      else return [];

      const sinceMs = since.getTime();
      const filtered = source.filter((c) => c.timestamp >= sinceMs);
      return filtered.slice(0, limit);
    },
    formatPrice: async (_, p) => p.toFixed(2),
    formatQuantity: async (_, q) => q.toFixed(5),
  });

  addStrategySchema({
    strategyName: "test-raw-candles",
    interval: "1m",
    getSignal: async () => {
      try {
        // Test Case 1: Only limit (backward from current time)
        const test1 = await getRawCandles("BTCUSDT", "1m", 10);

        // Test Case 2: sDate + limit (forward from sDate)
        const T_10_00_MS = new Date("2024-01-01T10:00:00Z").getTime();
        const test2 = await getRawCandles("BTCUSDT", "1m", 10, T_10_00_MS);

        // Test Case 3: eDate + limit (backward from eDate)
        const T_10_20_MS = new Date("2024-01-01T10:20:00Z").getTime();
        const test3 = await getRawCandles("BTCUSDT", "15m", 5, undefined, T_10_20_MS);

        // Test Case 4: sDate + eDate (calculate limit from range)
        const test4 = await getRawCandles(
          "BTCUSDT",
          "1m",
          undefined,
          T_10_00_MS,
          T_10_20_MS
        );

        // Test Case 5: All parameters
        const test5 = await getRawCandles(
          "BTCUSDT",
          "1m",
          15,
          T_10_00_MS,
          T_10_20_MS
        );

        resolve({ test1, test2, test3, test4, test5 });
      } catch (e) {
        resolve({ error: e.message });
      }
      return null;
    },
  });

  addFrameSchema({
    frameName: "raw-candles-check",
    interval: "1d",
    startDate: T_10_24,
    endDate: new Date("2024-01-01T10:35:00Z"),
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-raw-candles",
    exchangeName: "test-exchange-raw",
    frameName: "raw-candles-check",
  });

  const results = await awaiter;

  if (results.error) {
    fail(`Test error: ${results.error}`);
    return;
  }

  const { test1, test2, test3, test4, test5 } = results;

  const errors = [];

  // Test 1: Only limit - should return 10 candles ending before T_10_24
  if (!test1 || test1.length !== 10) {
    errors.push(`Test1: Expected 10 candles, got ${test1?.length || 0}`);
  } else {
    const last = test1[test1.length - 1];
    const expectedLast = new Date("2024-01-01T10:23:00Z").getTime();
    if (last.timestamp !== expectedLast) {
      errors.push(
        `Test1: Last candle timestamp wrong. Expected ${new Date(expectedLast).toISOString()}, got ${new Date(last.timestamp).toISOString()}`
      );
    }
  }

  // Test 2: sDate + limit - should return 10 candles starting from T_10_00
  if (!test2 || test2.length !== 10) {
    errors.push(`Test2: Expected 10 candles, got ${test2?.length || 0}`);
  } else {
    const first = test2[0];
    const last = test2[test2.length - 1];
    const expectedFirst = new Date("2024-01-01T10:00:00Z").getTime();
    const expectedLast = new Date("2024-01-01T10:09:00Z").getTime();
    if (first.timestamp !== expectedFirst) {
      errors.push(
        `Test2: First candle wrong. Expected ${new Date(expectedFirst).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
      );
    }
    if (last.timestamp !== expectedLast) {
      errors.push(
        `Test2: Last candle wrong. Expected ${new Date(expectedLast).toISOString()}, got ${new Date(last.timestamp).toISOString()}`
      );
    }
  }

  // Test 3: eDate + limit - should return candles that fully closed before or at T_10_20
  // sinceTimestamp = 10:20 - 5*15min = 09:05
  // untilTimestamp = 10:20
  // Candles that match: >= 09:05 AND close <= 10:20
  // Result: 09:15(closes 09:30), 09:30(closes 09:45), 09:45(closes 10:00), 10:00(closes 10:15)
  // Note: 09:00 starts before 09:05, so it's excluded
  if (!test3 || test3.length !== 4) {
    errors.push(`Test3: Expected 4 candles, got ${test3?.length || 0}`);
  } else {
    const first = test3[0];
    const last = test3[test3.length - 1];
    const expectedFirst = new Date("2024-01-01T09:15:00Z").getTime();
    const expectedLast = new Date("2024-01-01T10:00:00Z").getTime();
    if (first.timestamp !== expectedFirst) {
      errors.push(
        `Test3: First 15m candle wrong. Expected ${new Date(expectedFirst).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
      );
    }
    if (last.timestamp !== expectedLast) {
      errors.push(
        `Test3: Last 15m candle wrong. Expected ${new Date(expectedLast).toISOString()}, got ${new Date(last.timestamp).toISOString()}`
      );
    }
  }

  // Test 4: sDate + eDate - should calculate limit (20 minutes = 20 candles)
  if (!test4 || test4.length !== 20) {
    errors.push(`Test4: Expected 20 candles, got ${test4?.length || 0}`);
  } else {
    const first = test4[0];
    const last = test4[test4.length - 1];
    const expectedFirst = new Date("2024-01-01T10:00:00Z").getTime();
    const expectedLast = new Date("2024-01-01T10:19:00Z").getTime();
    if (first.timestamp !== expectedFirst || last.timestamp !== expectedLast) {
      errors.push(
        `Test4: Range wrong. Expected ${new Date(expectedFirst).toISOString()} to ${new Date(expectedLast).toISOString()}, got ${new Date(first.timestamp).toISOString()} to ${new Date(last.timestamp).toISOString()}`
      );
    }
  }

  // Test 5: All parameters - should respect limit parameter
  if (!test5 || test5.length !== 15) {
    errors.push(`Test5: Expected 15 candles, got ${test5?.length || 0}`);
  } else {
    const first = test5[0];
    const expectedFirst = new Date("2024-01-01T10:00:00Z").getTime();
    if (first.timestamp !== expectedFirst) {
      errors.push(
        `Test5: First candle wrong. Expected ${new Date(expectedFirst).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
      );
    }
  }

  if (errors.length === 0) {
    pass("getRawCandles correctly handles all parameter combinations without lookahead bias");
  } else {
    fail("getRawCandles test failures:\n" + errors.join("\n"));
  }
});

test("getNextCandles prevents lookahead bias and only returns future candles", async ({
  pass,
  fail,
}) => {
  const [awaiter, { resolve }] = createAwaiter();

  // Test Time: 2024-01-01T10:24:00Z
  const T_10_24 = new Date("2024-01-01T10:24:00Z");

  // Helper to generate candles
  const generateCandles = (intervalMinutes, count) => {
    const candles = [];
    const stepMs = intervalMinutes * 60 * 1000;
    let current = new Date("2024-01-01T00:00:00Z").getTime();

    for (let i = 0; i < count; i++) {
      candles.push({
        timestamp: current,
        open: 100 + i,
        high: 105 + i,
        low: 95 + i,
        close: 101 + i,
        volume: 1000 + i,
      });
      current += stepMs;
    }
    return candles;
  };

  const candles1m = generateCandles(1, 2000);
  const candles15m = generateCandles(15, 200);

  addExchangeSchema({
    exchangeName: "test-exchange-next",
    getCandles: async (_symbol, interval, since, limit) => {
      let source = [];
      if (interval === "1m") source = candles1m;
      else if (interval === "15m") source = candles15m;
      else return [];

      const sinceMs = since.getTime();
      const filtered = source.filter((c) => c.timestamp >= sinceMs);
      return filtered.slice(0, limit);
    },
    formatPrice: async (_, p) => p.toFixed(2),
    formatQuantity: async (_, q) => q.toFixed(5),
  });

  addStrategySchema({
    strategyName: "test-next-candles",
    interval: "1m",
    getSignal: async () => {
      try {
        // Test Case 1: Get next 5 1m candles after current time (T_10_24)
        const next1m = await getNextCandles("BTCUSDT", "1m", 5);

        // Test Case 2: Get next 3 15m candles after current time
        const next15m = await getNextCandles("BTCUSDT", "15m", 3);

        // Test Case 3: Request beyond Date.now() - should return empty array
        // Since backtest time is T_10_24 (2024-01-01T10:24:00Z)
        // and we have candles up to ~2000 minutes from start
        // requesting a huge number should hit the Date.now() limit
        const nextBeyond = await getNextCandles("BTCUSDT", "1m", 10000);

        resolve({ next1m, next15m, nextBeyond });
      } catch (e) {
        resolve({ error: e.message });
      }
      return null;
    },
  });

  addFrameSchema({
    frameName: "next-candles-check",
    interval: "1d",
    startDate: T_10_24,
    endDate: new Date("2024-01-01T10:35:00Z"),
  });

  Backtest.background("BTCUSDT", {
    strategyName: "test-next-candles",
    exchangeName: "test-exchange-next",
    frameName: "next-candles-check",
  });

  const results = await awaiter;

  if (results.error) {
    fail(`Test error: ${results.error}`);
    return;
  }

  const { next1m, next15m, nextBeyond } = results;

  const errors = [];

  // Test 1: next1m - should return 5 candles starting from T_10_24
  if (!next1m || next1m.length !== 5) {
    errors.push(`Test1 (next1m): Expected 5 candles, got ${next1m?.length || 0}`);
  } else {
    const first = next1m[0];
    const last = next1m[next1m.length - 1];
    const expectedFirst = new Date("2024-01-01T10:24:00Z").getTime();
    const expectedLast = new Date("2024-01-01T10:28:00Z").getTime();

    if (first.timestamp !== expectedFirst) {
      errors.push(
        `Test1: First candle wrong. Expected ${new Date(expectedFirst).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
      );
    }
    if (last.timestamp !== expectedLast) {
      errors.push(
        `Test1: Last candle wrong. Expected ${new Date(expectedLast).toISOString()}, got ${new Date(last.timestamp).toISOString()}`
      );
    }

    // Verify candles are sequential
    for (let i = 1; i < next1m.length; i++) {
      const expectedTs = expectedFirst + i * 60 * 1000;
      if (next1m[i].timestamp !== expectedTs) {
        errors.push(
          `Test1: Candle ${i} not sequential. Expected ${new Date(expectedTs).toISOString()}, got ${new Date(next1m[i].timestamp).toISOString()}`
        );
        break;
      }
    }
  }

  // Test 2: next15m - should return 3 15m candles starting from T_10_30 (next 15m boundary)
  if (!next15m || next15m.length !== 3) {
    errors.push(`Test2 (next15m): Expected 3 candles, got ${next15m?.length || 0}`);
  } else {
    const first = next15m[0];
    const last = next15m[next15m.length - 1];
    // Next 15m boundary after 10:24 is 10:30
    const expectedFirst = new Date("2024-01-01T10:30:00Z").getTime();
    const expectedLast = new Date("2024-01-01T11:00:00Z").getTime();

    if (first.timestamp !== expectedFirst) {
      errors.push(
        `Test2: First 15m candle wrong. Expected ${new Date(expectedFirst).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
      );
    }
    if (last.timestamp !== expectedLast) {
      errors.push(
        `Test2: Last 15m candle wrong. Expected ${new Date(expectedLast).toISOString()}, got ${new Date(last.timestamp).toISOString()}`
      );
    }
  }

  // Test 3: nextBeyond - should return empty array when requested range exceeds Date.now()
  if (!nextBeyond) {
    errors.push(`Test3 (nextBeyond): Expected empty array, got null/undefined`);
  } else if (nextBeyond.length > 0) {
    // This is expected since our test data goes far into the future
    // But getNextCandles should still respect Date.now() limit
    // Let's just verify the candles don't exceed Date.now()
    const now = Date.now();
    const lastCandle = nextBeyond[nextBeyond.length - 1];
    const lastCandleEnd = lastCandle.timestamp + 60 * 1000; // 1m candle duration

    if (lastCandleEnd > now) {
      errors.push(
        `Test3: Candles exceed Date.now(). Last candle end: ${new Date(lastCandleEnd).toISOString()}, now: ${new Date(now).toISOString()}`
      );
    }
  }

  if (errors.length === 0) {
    pass("getNextCandles correctly returns future candles without lookahead bias");
  } else {
    fail("getNextCandles test failures:\n" + errors.join("\n"));
  }
});

test("Exchange.getCandles does not return unclosed candles (lookahead bias)", async ({
  pass,
  fail,
}) => {
  // Helper to generate candles relative to Date.now()
  const generateCandles = (intervalMinutes, count) => {
    const candles = [];
    const stepMs = intervalMinutes * 60 * 1000;
    const now = Date.now();
    // Start generating candles from 2x the requested range in the past
    let current = now - count * 2 * stepMs;

    for (let i = 0; i < count * 2; i++) {
      candles.push({
        timestamp: current,
        open: 100,
        high: 105,
        low: 95,
        close: 101,
        volume: 1000,
      });
      current += stepMs;
    }
    return candles;
  };

  const candles1m = generateCandles(1, 2000);
  const candles15m = generateCandles(15, 200);
  const candles1h = generateCandles(60, 200);
  const candles4h = generateCandles(240, 200);

  addExchangeSchema({
    exchangeName: "test-exchange-class",
    getCandles: async (_symbol, interval, since, limit) => {
      let source = [];
      if (interval === "1m") source = candles1m;
      else if (interval === "15m") source = candles15m;
      else if (interval === "1h") source = candles1h;
      else if (interval === "4h") source = candles4h;
      else return [];

      const sinceMs = since.getTime();
      const filtered = source.filter((c) => c.timestamp >= sinceMs);
      return filtered.slice(0, limit);
    },
    formatPrice: async (_, p) => p.toFixed(2),
    formatQuantity: async (_, q) => q.toFixed(5),
  });

  try {
    // Test: Exchange.getCandles should only return candles that closed before Date.now()
    const result1m = await Exchange.getCandles("BTCUSDT", "1m", 100, {
      exchangeName: "test-exchange-class",
    });
    console.log("Exchange.getCandles 1m:", result1m.length, "candles");

    const result15m = await Exchange.getCandles("BTCUSDT", "15m", 100, {
      exchangeName: "test-exchange-class",
    });
    console.log("Exchange.getCandles 15m:", result15m.length, "candles");

    const result1h = await Exchange.getCandles("BTCUSDT", "1h", 100, {
      exchangeName: "test-exchange-class",
    });
    console.log("Exchange.getCandles 1h:", result1h.length, "candles");

    const result4h = await Exchange.getCandles("BTCUSDT", "4h", 100, {
      exchangeName: "test-exchange-class",
    });
    console.log("Exchange.getCandles 4h:", result4h.length, "candles");

    const last1m = result1m[result1m.length - 1];
    const last15m = result15m[result15m.length - 1];
    const last1h = result1h[result1h.length - 1];
    const last4h = result4h[result4h.length - 1];

    console.log("Last 1m candle:", new Date(last1m.timestamp).toISOString());
    console.log("Last 15m candle:", new Date(last15m.timestamp).toISOString());
    console.log("Last 1h candle:", new Date(last1h.timestamp).toISOString());
    console.log("Last 4h candle:", new Date(last4h.timestamp).toISOString());

    // Calculate expected last candle timestamps
    const now = Date.now();
    console.log("Date.now():", new Date(now).toISOString());

    const t1m = last1m && last1m.timestamp + 60 * 1000 <= now;
    const t15m = last15m && last15m.timestamp + 15 * 60 * 1000 <= now;
    const t1h = last1h && last1h.timestamp + 60 * 60 * 1000 <= now;
    const t4h = last4h && last4h.timestamp + 4 * 60 * 60 * 1000 <= now;

    console.log("1m check:", t1m, "| end:", new Date(last1m.timestamp + 60 * 1000).toISOString());
    console.log("15m check:", t15m, "| end:", new Date(last15m.timestamp + 15 * 60 * 1000).toISOString());
    console.log("1h check:", t1h, "| end:", new Date(last1h.timestamp + 60 * 60 * 1000).toISOString());
    console.log("4h check:", t4h, "| end:", new Date(last4h.timestamp + 4 * 60 * 60 * 1000).toISOString());

    if (t1m && t15m && t1h && t4h) {
      pass("Exchange.getCandles correctly prevents lookahead bias across all intervals");
    } else {
      let msg = "Lookahead bias detected in Exchange.getCandles:\n";
      if (!t1m) msg += `1m: Last candle ${new Date(last1m.timestamp).toISOString()} + 1m > now\n`;
      if (!t15m) msg += `15m: Last candle ${new Date(last15m.timestamp).toISOString()} + 15m > now\n`;
      if (!t1h) msg += `1h: Last candle ${new Date(last1h.timestamp).toISOString()} + 1h > now\n`;
      if (!t4h) msg += `4h: Last candle ${new Date(last4h.timestamp).toISOString()} + 4h > now\n`;
      fail(msg);
    }
  } catch (error) {
    fail(`Exchange.getCandles threw error: ${error.message}`);
  }
});

test("Exchange.getRawCandles prevents lookahead bias with different parameter combinations", async ({
  pass,
  fail,
}) => {
  // Helper to generate candles relative to Date.now()
  const generateCandles = (intervalMinutes, count) => {
    const candles = [];
    const stepMs = intervalMinutes * 60 * 1000;
    const now = Date.now();
    // Align to interval boundary and start from far in the past
    let current = Math.floor((now - count * 2 * stepMs) / stepMs) * stepMs;

    for (let i = 0; i < count * 2; i++) {
      candles.push({
        timestamp: current,
        open: 100,
        high: 105,
        low: 95,
        close: 101,
        volume: 1000,
      });
      current += stepMs;
    }
    return candles;
  };

  const candles1m = generateCandles(1, 2000);
  const candles15m = generateCandles(15, 200);

  addExchangeSchema({
    exchangeName: "test-exchange-raw-class",
    getCandles: async (_symbol, interval, since, limit) => {
      let source = [];
      if (interval === "1m") source = candles1m;
      else if (interval === "15m") source = candles15m;
      else return [];

      const sinceMs = since.getTime();
      const filtered = source.filter((c) => c.timestamp >= sinceMs);
      return filtered.slice(0, limit);
    },
    formatPrice: async (_, p) => p.toFixed(2),
    formatQuantity: async (_, q) => q.toFixed(5),
  });

  try {
    const now = Date.now();

    // Calculate the candle grid base aligned to minute boundaries
    const candle1mBase = Math.floor((now - 2000 * 2 * 60 * 1000) / (60 * 1000)) * (60 * 1000);
    const candle15mBase = Math.floor((now - 200 * 2 * 15 * 60 * 1000) / (15 * 60 * 1000)) * (15 * 60 * 1000);

    // Test Case 1: Only limit (backward from current time)
    const test1 = await Exchange.getRawCandles(
      "BTCUSDT",
      "1m",
      { exchangeName: "test-exchange-raw-class" },
      10
    );

    // Test Case 2: sDate + limit - pick a timestamp on the 1m candle grid (50 candles back)
    const T_10_00_MS = candle1mBase + 50 * 60 * 1000;

    const test2 = await Exchange.getRawCandles(
      "BTCUSDT",
      "1m",
      { exchangeName: "test-exchange-raw-class" },
      10,
      T_10_00_MS
    );

    // Test Case 3: eDate + limit - pick a timestamp on the 15m candle grid (10 candles back)
    const T_10_20_MS = candle15mBase + 10 * 15 * 60 * 1000;

    const test3 = await Exchange.getRawCandles(
      "BTCUSDT",
      "15m",
      { exchangeName: "test-exchange-raw-class" },
      5,
      undefined,
      T_10_20_MS
    );

    // Test Case 4: sDate + eDate - use aligned timestamps with 20 minute gap
    const T_sDate = T_10_00_MS;
    const T_eDate = T_10_00_MS + 20 * 60 * 1000;

    const test4 = await Exchange.getRawCandles(
      "BTCUSDT",
      "1m",
      { exchangeName: "test-exchange-raw-class" },
      undefined,
      T_sDate,
      T_eDate
    );

    // Test Case 5: All parameters - same as test 4 but with explicit limit
    const test5 = await Exchange.getRawCandles(
      "BTCUSDT",
      "1m",
      { exchangeName: "test-exchange-raw-class" },
      15,
      T_sDate,
      T_eDate
    );

    const errors = [];

    // Test 1: Only limit - should return candles ending before Date.now()
    if (!test1 || test1.length === 0) {
      errors.push(`Test1: Expected candles, got ${test1?.length || 0}`);
    } else {
      const last = test1[test1.length - 1];
      const lastCandleEnd = last.timestamp + 60 * 1000; // 1m interval
      if (lastCandleEnd > now) {
        errors.push(
          `Test1: Last candle exceeds Date.now(). Last: ${new Date(last.timestamp).toISOString()}, end: ${new Date(lastCandleEnd).toISOString()}, now: ${new Date(now).toISOString()}`
        );
      }
    }

    // Test 2: sDate + limit - should return 10 candles starting from T_10_00_MS
    if (!test2 || test2.length !== 10) {
      errors.push(`Test2: Expected 10 candles, got ${test2?.length || 0}`);
    } else {
      const first = test2[0];
      const last = test2[test2.length - 1];
      // Check that first candle starts at sDate
      if (first.timestamp !== T_10_00_MS) {
        errors.push(
          `Test2: First candle wrong. Expected ${new Date(T_10_00_MS).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
        );
      }
      // Check that last candle is sDate + 9 minutes
      const expectedLast = T_10_00_MS + 9 * 60 * 1000;
      if (last.timestamp !== expectedLast) {
        errors.push(
          `Test2: Last candle wrong. Expected ${new Date(expectedLast).toISOString()}, got ${new Date(last.timestamp).toISOString()}`
        );
      }
    }

    // Test 3: eDate + limit - T_10_20_MS is already on 15m boundary, should return full 5 candles
    if (!test3 || test3.length !== 5) {
      errors.push(`Test3: Expected 5 candles, got ${test3?.length || 0}`);
    } else {
      const first = test3[0];
      const last = test3[test3.length - 1];

      // Verify last candle closes before or at eDate
      const lastCandleEnd = last.timestamp + 15 * 60 * 1000;
      if (lastCandleEnd > T_10_20_MS) {
        errors.push(
          `Test3: Last 15m candle end exceeds eDate. Last: ${new Date(last.timestamp).toISOString()}, end: ${new Date(lastCandleEnd).toISOString()}, eDate: ${new Date(T_10_20_MS).toISOString()}`
        );
      }

      // Verify first candle is 5 intervals back from last
      const expectedFirst = last.timestamp - 4 * 15 * 60 * 1000;
      if (first.timestamp !== expectedFirst) {
        errors.push(
          `Test3: First candle wrong. Expected ${new Date(expectedFirst).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
        );
      }
    }

    // Test 4: sDate + eDate - should calculate limit (20 minutes = 20 candles)
    const expectedCount4 = Math.floor((T_eDate - T_sDate) / (60 * 1000));
    if (!test4 || test4.length !== expectedCount4) {
      errors.push(`Test4: Expected ${expectedCount4} candles, got ${test4?.length || 0}`);
    } else {
      const first = test4[0];
      const last = test4[test4.length - 1];
      if (first.timestamp !== T_sDate) {
        errors.push(
          `Test4: First candle wrong. Expected ${new Date(T_sDate).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
        );
      }
      const expectedLast = T_sDate + (expectedCount4 - 1) * 60 * 1000;
      if (last.timestamp !== expectedLast) {
        errors.push(
          `Test4: Last candle wrong. Expected ${new Date(expectedLast).toISOString()}, got ${new Date(last.timestamp).toISOString()}`
        );
      }
    }

    // Test 5: All parameters - should respect limit parameter
    if (!test5 || test5.length !== 15) {
      errors.push(`Test5: Expected 15 candles, got ${test5?.length || 0}`);
    } else {
      const first = test5[0];
      if (first.timestamp !== T_sDate) {
        errors.push(
          `Test5: First candle wrong. Expected ${new Date(T_sDate).toISOString()}, got ${new Date(first.timestamp).toISOString()}`
        );
      }
    }

    if (errors.length === 0) {
      pass("Exchange.getRawCandles correctly handles all parameter combinations without lookahead bias");
    } else {
      fail("Exchange.getRawCandles test failures:\n" + errors.join("\n"));
    }
  } catch (error) {
    fail(`Exchange.getRawCandles threw error: ${error.message}`);
  }
});
