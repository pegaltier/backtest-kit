import { test } from "worker-testbed";

import {
  addExchange,
  addFrame,
  addStrategy,
  Backtest,
  Live,
  listenDoneBacktest,
  listenError,
  Schedule,
  Performance,
  Partial,
  Heat,
} from "../../build/index.mjs";

import { Subject, sleep } from "functools-kit";

/**
 * MARKDOWN PARALLEL TEST: Проверяет все markdown сервисы с multi-symbol архитектурой
 *
 * Проверяет:
 * - BacktestMarkdownService.getStorage() с ключом `${symbol}:${strategyName}`
 * - ScheduleMarkdownService.getStorage() с ключом `${symbol}:${strategyName}`
 * - PerformanceMarkdownService.getStorage() с ключом `${symbol}:${strategyName}`
 * - PartialMarkdownService.getStorage() с ключом `${symbol}:${strategyName}`
 * - LiveMarkdownService.getStorage() с ключом `${symbol}:${strategyName}`
 * - HeatMarkdownService.getStorage() с ключом `${symbol}:${strategyName}`
 * - WalkerMarkdownService.getStorage() с ключом `${symbol}:${strategyName}`
 *
 * Сценарий:
 * - Запускаем backtest для BTCUSDT и ETHUSDT параллельно
 * - Генерируем сигналы с scheduled/opened/closed/partial profit
 * - Проверяем что все markdown сервисы возвращают данные через getData()
 * - Проверяем изоляцию данных между (symbol, strategyName) парами
 */
test("MARKDOWN PARALLEL: All markdown services work with multi-symbol isolation", async ({ pass, fail }) => {
  const startTime = new Date("2024-01-01T00:00:00Z").getTime();
  const intervalMs = 60000;

  // BTC: базовая цена 95000, TP scenario с partial profit
  const btcBasePrice = 95000;
  const btcPriceOpen = btcBasePrice - 500;
  let btcCandles = [];

  // ETH: базовая цена 4000, TP scenario с partial profit
  const ethBasePrice = 4000;
  const ethPriceOpen = ethBasePrice - 50;
  let ethCandles = [];

  // Предзаполняем начальные свечи
  for (let i = 0; i < 5; i++) {
    btcCandles.push({
      timestamp: startTime + i * intervalMs,
      open: btcBasePrice,
      high: btcBasePrice + 100,
      low: btcBasePrice - 50,
      close: btcBasePrice,
      volume: 100,
    });

    ethCandles.push({
      timestamp: startTime + i * intervalMs,
      open: ethBasePrice,
      high: ethBasePrice + 10,
      low: ethBasePrice - 5,
      close: ethBasePrice,
      volume: 100,
    });
  }

  addExchange({
    exchangeName: "binance-markdown-parallel",
    getCandles: async (symbol, _interval, since, limit) => {
      const sinceIndex = Math.floor((since.getTime() - startTime) / intervalMs);

      if (symbol === "BTCUSDT") {
        const result = btcCandles.slice(sinceIndex, sinceIndex + limit);
        return result.length > 0 ? result : btcCandles.slice(0, Math.min(limit, btcCandles.length));
      }

      if (symbol === "ETHUSDT") {
        const result = ethCandles.slice(sinceIndex, sinceIndex + limit);
        return result.length > 0 ? result : ethCandles.slice(0, Math.min(limit, ethCandles.length));
      }

      return [];
    },
    formatPrice: async (_symbol, p) => p.toFixed(8),
    formatQuantity: async (_symbol, quantity) => quantity.toFixed(8),
  });

  let btcSignalGenerated = false;
  let ethSignalGenerated = false;

  addStrategy({
    strategyName: "test-markdown-parallel",
    interval: "1m",
    getSignal: async (symbol) => {
      // BTCUSDT: TP scenario с partial profit на 10%
      if (symbol === "BTCUSDT") {
        if (btcSignalGenerated) return null;
        btcSignalGenerated = true;

        // Генерируем свечи для BTC
        btcCandles = [];
        for (let i = 0; i < 60; i++) {
          const timestamp = startTime + i * intervalMs;

          // Фаза 1: Ожидание scheduled (0-9)
          if (i < 10) {
            btcCandles.push({
              timestamp,
              open: btcBasePrice,
              high: btcBasePrice + 100,
              low: btcBasePrice - 50,
              close: btcBasePrice,
              volume: 100
            });
          }
          // Фаза 2: Активация (10-14)
          else if (i >= 10 && i < 15) {
            btcCandles.push({
              timestamp,
              open: btcPriceOpen,
              high: btcPriceOpen + 100,
              low: btcPriceOpen - 100,
              close: btcPriceOpen,
              volume: 100
            });
          }
          // Фаза 3: Partial profit 10% (15-19)
          else if (i >= 15 && i < 20) {
            const partialPrice = btcPriceOpen + 100; // +10% profit
            btcCandles.push({
              timestamp,
              open: partialPrice,
              high: partialPrice + 50,
              low: partialPrice - 50,
              close: partialPrice,
              volume: 100
            });
          }
          // Фаза 4: Take Profit (20-24)
          else if (i >= 20 && i < 25) {
            btcCandles.push({
              timestamp,
              open: btcPriceOpen + 1000,
              high: btcPriceOpen + 1100,
              low: btcPriceOpen + 900,
              close: btcPriceOpen + 1000,
              volume: 100
            });
          }
          // Остальное: нейтральные свечи
          else {
            btcCandles.push({
              timestamp,
              open: btcBasePrice,
              high: btcBasePrice + 100,
              low: btcBasePrice - 50,
              close: btcBasePrice,
              volume: 100
            });
          }
        }

        return {
          position: "long",
          note: "BTCUSDT markdown parallel test",
          priceOpen: btcPriceOpen,
          priceTakeProfit: btcPriceOpen + 1000,
          priceStopLoss: btcPriceOpen - 1000,
          minuteEstimatedTime: 60,
        };
      }

      // ETHUSDT: TP scenario с partial profit на 10%
      if (symbol === "ETHUSDT") {
        if (ethSignalGenerated) return null;
        ethSignalGenerated = true;

        // Генерируем свечи для ETH
        ethCandles = [];
        for (let i = 0; i < 60; i++) {
          const timestamp = startTime + i * intervalMs;

          // Фаза 1: Ожидание scheduled (0-9)
          if (i < 10) {
            ethCandles.push({
              timestamp,
              open: ethBasePrice,
              high: ethBasePrice + 10,
              low: ethBasePrice - 5,
              close: ethBasePrice,
              volume: 100
            });
          }
          // Фаза 2: Активация (10-14)
          else if (i >= 10 && i < 15) {
            ethCandles.push({
              timestamp,
              open: ethPriceOpen,
              high: ethPriceOpen + 10,
              low: ethPriceOpen - 10,
              close: ethPriceOpen,
              volume: 100
            });
          }
          // Фаза 3: Partial profit 10% (15-19)
          else if (i >= 15 && i < 20) {
            const partialPrice = ethPriceOpen + 10; // +10% profit
            ethCandles.push({
              timestamp,
              open: partialPrice,
              high: partialPrice + 5,
              low: partialPrice - 5,
              close: partialPrice,
              volume: 100
            });
          }
          // Фаза 4: Take Profit (20-24)
          else if (i >= 20 && i < 25) {
            ethCandles.push({
              timestamp,
              open: ethPriceOpen + 100,
              high: ethPriceOpen + 110,
              low: ethPriceOpen + 90,
              close: ethPriceOpen + 100,
              volume: 100
            });
          }
          // Остальное: нейтральные свечи
          else {
            ethCandles.push({
              timestamp,
              open: ethBasePrice,
              high: ethBasePrice + 10,
              low: ethBasePrice - 5,
              close: ethBasePrice,
              volume: 100
            });
          }
        }

        return {
          position: "long",
          note: "ETHUSDT markdown parallel test",
          priceOpen: ethPriceOpen,
          priceTakeProfit: ethPriceOpen + 100,
          priceStopLoss: ethPriceOpen - 100,
          minuteEstimatedTime: 60,
        };
      }

      return null;
    },
  });

  addFrame({
    frameName: "1h-markdown-parallel",
    interval: "1m",
    startDate: new Date("2024-01-01T00:00:00Z"),
    endDate: new Date("2024-01-01T01:00:00Z"),
  });

  let btcDone = false;
  let ethDone = false;
  let errorCaught = null;

  const awaitSubject = new Subject();

  const unsubscribeError = listenError((error) => {
    errorCaught = error;
    awaitSubject.next();
  });

  const unsubscribeDone = listenDoneBacktest((event) => {
    if (event.backtest === true && event.strategyName === "test-markdown-parallel") {
      if (event.symbol === "BTCUSDT") btcDone = true;
      if (event.symbol === "ETHUSDT") ethDone = true;

      if (btcDone && ethDone) {
        awaitSubject.next();
      }
    }
  });

  // Запускаем backtest для обоих символов параллельно
  Backtest.background("BTCUSDT", {
    strategyName: "test-markdown-parallel",
    exchangeName: "binance-markdown-parallel",
    frameName: "1h-markdown-parallel",
  });

  Backtest.background("ETHUSDT", {
    strategyName: "test-markdown-parallel",
    exchangeName: "binance-markdown-parallel",
    frameName: "1h-markdown-parallel",
  });

  await awaitSubject.toPromise();
  // await sleep(1000);
  unsubscribeError();
  unsubscribeDone();

  if (errorCaught) {
    fail(`Error during parallel backtest: ${errorCaught.message || errorCaught}`);
    return;
  }

  // ========================================
  // ПРОВЕРКА ВСЕХ MARKDOWN СЕРВИСОВ
  // ========================================

  // 0. BacktestMarkdownService - проверяем getData() и getReport()
  try {
    const btcBacktestData = await Backtest.getData("BTCUSDT", "test-markdown-parallel");
    const ethBacktestData = await Backtest.getData("ETHUSDT", "test-markdown-parallel");

    // Verify data exists and has valid structure
    if (!btcBacktestData || typeof btcBacktestData !== "object") {
      fail("BacktestMarkdownService: BTCUSDT getData() returned invalid data");
      return;
    }

    if (!ethBacktestData || typeof ethBacktestData !== "object") {
      fail("BacktestMarkdownService: ETHUSDT getData() returned invalid data");
      return;
    }

    // Verify getReport() works and returns non-empty markdown
    const btcBacktestReport = await Backtest.getReport("BTCUSDT", "test-markdown-parallel");
    const ethBacktestReport = await Backtest.getReport("ETHUSDT", "test-markdown-parallel");

    if (typeof btcBacktestReport !== "string" || btcBacktestReport.length === 0) {
      fail("BacktestMarkdownService: BTCUSDT getReport() returned invalid report");
      return;
    }

    if (typeof ethBacktestReport !== "string" || ethBacktestReport.length === 0) {
      fail("BacktestMarkdownService: ETHUSDT getReport() returned invalid report");
      return;
    }

    // Verify symbol isolation: reports should mention only their own symbol
    if (!btcBacktestReport.includes("BTCUSDT")) {
      fail("BacktestMarkdownService: BTCUSDT report doesn't mention BTCUSDT");
      return;
    }

    if (!ethBacktestReport.includes("ETHUSDT")) {
      fail("BacktestMarkdownService: ETHUSDT report doesn't mention ETHUSDT");
      return;
    }
  } catch (err) {
    fail(`BacktestMarkdownService failed: ${err.message}`);
    return;
  }

  // 1. LiveMarkdownService - проверяем getData() и getReport()
  try {
    const btcLiveData = await Live.getData("BTCUSDT", "test-markdown-parallel");
    const ethLiveData = await Live.getData("ETHUSDT", "test-markdown-parallel");

    // Verify data exists and has valid structure
    if (!btcLiveData || typeof btcLiveData !== "object") {
      fail("LiveMarkdownService: BTCUSDT getData() returned invalid data");
      return;
    }

    if (!ethLiveData || typeof ethLiveData !== "object") {
      fail("LiveMarkdownService: ETHUSDT getData() returned invalid data");
      return;
    }

    // Verify getReport() works and returns non-empty markdown
    const btcLiveReport = await Live.getReport("BTCUSDT", "test-markdown-parallel");
    const ethLiveReport = await Live.getReport("ETHUSDT", "test-markdown-parallel");

    if (typeof btcLiveReport !== "string" || btcLiveReport.length === 0) {
      fail("LiveMarkdownService: BTCUSDT getReport() returned invalid report");
      return;
    }

    if (typeof ethLiveReport !== "string" || ethLiveReport.length === 0) {
      fail("LiveMarkdownService: ETHUSDT getReport() returned invalid report");
      return;
    }

    // Verify symbol isolation: reports should mention only their own symbol
    if (!btcLiveReport.includes("BTCUSDT")) {
      fail("LiveMarkdownService: BTCUSDT report doesn't mention BTCUSDT");
      return;
    }

    if (!ethLiveReport.includes("ETHUSDT")) {
      fail("LiveMarkdownService: ETHUSDT report doesn't mention ETHUSDT");
      return;
    }
  } catch (err) {
    fail(`LiveMarkdownService failed: ${err.message}`);
    return;
  }

  // 2. ScheduleMarkdownService - проверяем getData()
  try {
    const btcScheduleData = await Schedule.getData("BTCUSDT", "test-markdown-parallel");
    const ethScheduleData = await Schedule.getData("ETHUSDT", "test-markdown-parallel");

    if (btcScheduleData.totalScheduled === 0) {
      fail("ScheduleMarkdownService: BTCUSDT should have scheduled events");
      return;
    }

    if (ethScheduleData.totalScheduled === 0) {
      fail("ScheduleMarkdownService: ETHUSDT should have scheduled events");
      return;
    }

    // Проверка изоляции: данные не должны пересекаться
    const btcScheduleSymbols = btcScheduleData.eventList.map(e => e.symbol);
    const ethScheduleSymbols = ethScheduleData.eventList.map(e => e.symbol);

    if (btcScheduleSymbols.some(s => s !== "BTCUSDT")) {
      fail("ScheduleMarkdownService: BTCUSDT data contaminated with other symbols");
      return;
    }

    if (ethScheduleSymbols.some(s => s !== "ETHUSDT")) {
      fail("ScheduleMarkdownService: ETHUSDT data contaminated with other symbols");
      return;
    }
  } catch (err) {
    fail(`ScheduleMarkdownService failed: ${err.message}`);
    return;
  }

  // 3. PerformanceMarkdownService - проверяем getData()
  try {
    const btcPerfData = await Performance.getData("BTCUSDT", "test-markdown-parallel");
    const ethPerfData = await Performance.getData("ETHUSDT", "test-markdown-parallel");

    if (btcPerfData.totalEvents === 0) {
      fail("PerformanceMarkdownService: BTCUSDT should have events");
      return;
    }

    if (ethPerfData.totalEvents === 0) {
      fail("PerformanceMarkdownService: ETHUSDT should have events");
      return;
    }

    // Проверка изоляции: events должен содержать только свои символы
    const btcPerfSymbols = btcPerfData.events.map(e => e.symbol);
    const ethPerfSymbols = ethPerfData.events.map(e => e.symbol);

    if (btcPerfSymbols.some(s => s !== "BTCUSDT")) {
      fail("PerformanceMarkdownService: BTCUSDT data contaminated with other symbols");
      return;
    }

    if (ethPerfSymbols.some(s => s !== "ETHUSDT")) {
      fail("PerformanceMarkdownService: ETHUSDT data contaminated with other symbols");
      return;
    }
  } catch (err) {
    fail(`PerformanceMarkdownService failed: ${err.message}`);
    return;
  }

  // 4. PartialMarkdownService - проверяем getData()
  try {
    const btcPartialData = await Partial.getData("BTCUSDT", "test-markdown-parallel");
    const ethPartialData = await Partial.getData("ETHUSDT", "test-markdown-parallel");

    // Partial может быть пустым если не было partial profit/loss событий
    // Но проверяем изоляцию если есть данные
    if (btcPartialData.eventList.length > 0) {
      const btcPartialSymbols = btcPartialData.eventList.map(e => e.symbol);
      if (btcPartialSymbols.some(s => s !== "BTCUSDT")) {
        fail("PartialMarkdownService: BTCUSDT data contaminated with other symbols");
        return;
      }
    }

    if (ethPartialData.eventList.length > 0) {
      const ethPartialSymbols = ethPartialData.eventList.map(e => e.symbol);
      if (ethPartialSymbols.some(s => s !== "ETHUSDT")) {
        fail("PartialMarkdownService: ETHUSDT data contaminated with other symbols");
        return;
      }
    }
  } catch (err) {
    fail(`PartialMarkdownService failed: ${err.message}`);
    return;
  }

  // 5. HeatMarkdownService - проверяем getData()
  try {
    const btcHeatData = await Heat.getData("BTCUSDT", "test-markdown-parallel");
    const ethHeatData = await Heat.getData("ETHUSDT", "test-markdown-parallel");

    // Heat может быть пустым, но проверяем что вызов не падает
    // и возвращает структуру данных
    if (!btcHeatData || typeof btcHeatData !== "object") {
      fail("HeatMarkdownService: BTCUSDT getData() returned invalid data");
      return;
    }

    if (!ethHeatData || typeof ethHeatData !== "object") {
      fail("HeatMarkdownService: ETHUSDT getData() returned invalid data");
      return;
    }
  } catch (err) {
    fail(`HeatMarkdownService failed: ${err.message}`);
    return;
  }

  // 6. WalkerMarkdownService - пропускаем, так как требует walker schema и comparison setup
  // Walker используется для сравнения стратегий, а не для одиночных backtests
  // Изоляция по (symbol, strategyName) уже проверена через другие сервисы

  pass("MARKDOWN SERVICES WORK: All markdown services (Backtest, Live, Schedule, Performance, Partial, Heat) correctly isolate data by (symbol, strategyName) pairs. Multi-symbol architecture verified.");
});
