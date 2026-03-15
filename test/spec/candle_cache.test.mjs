import { test } from "worker-testbed";
import { PersistCandleAdapter } from "../../build/index.mjs";

const MS_PER_MINUTE = 60_000;

/**
 * In-memory adapter for testing PersistCandleAdapter.
 * Replaces file-based PersistBase with a simple Map.
 */
class PersistMemory {
  _store = new Map();

  constructor(_entityName, _baseDir) {}

  async waitForInit(_initial) {
    void 0;
  }

  async readValue(entityId) {
    const value = this._store.get(String(entityId));
    if (value === undefined) {
      throw new Error(`Entity ${entityId} not found`);
    }
    return value;
  }

  async hasValue(entityId) {
    return this._store.has(String(entityId));
  }

  async writeValue(entityId, entity) {
    this._store.set(String(entityId), entity);
  }

  async *keys() {
    const ids = [...this._store.keys()].sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );
    for (const id of ids) {
      yield id;
    }
  }
}

const makeCandle = (timestamp, price = 50000) => ({
  timestamp,
  open: price,
  high: price + 100,
  low: price - 100,
  close: price,
  volume: 10,
});

test("PersistCandleAdapter: readCandlesData returns null on empty cache", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp = new Date("2024-01-01T00:00:00Z").getTime();
  const untilTimestamp = sinceTimestamp + 5 * MS_PER_MINUTE;

  const result = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-empty",
    "1m",
    "binance-cache-1",
    5,
    sinceTimestamp,
    untilTimestamp,
  );

  if (result === null) {
    pass("readCandlesData returns null for empty cache");
    return;
  }

  fail(`Expected null, got ${JSON.stringify(result)}`);
});

test("PersistCandleAdapter: writeCandlesData then readCandlesData returns all candles", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp = new Date("2024-02-01T00:00:00Z").getTime();
  const limit = 5;
  const untilTimestamp = sinceTimestamp + limit * MS_PER_MINUTE;

  const candles = [];
  for (let i = 0; i < limit; i++) {
    candles.push(makeCandle(sinceTimestamp + i * MS_PER_MINUTE));
  }

  await PersistCandleAdapter.writeCandlesData(candles, "BTCUSDT-write", "1m", "binance-cache-2");

  const result = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-write",
    "1m",
    "binance-cache-2",
    limit,
    sinceTimestamp,
    untilTimestamp,
  );

  if (!Array.isArray(result)) {
    fail(`Expected array, got ${result}`);
    return;
  }

  if (result.length !== limit) {
    fail(`Expected ${limit} candles, got ${result.length}`);
    return;
  }

  pass(`readCandlesData returned ${result.length} candles after write`);
});

test("PersistCandleAdapter: readCandlesData returns null when subset is missing", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp = new Date("2024-03-01T00:00:00Z").getTime();
  const limit = 5;
  const untilTimestamp = sinceTimestamp + limit * MS_PER_MINUTE;

  // Write only 3 out of 5 candles (skip index 1 and 3)
  const partialCandles = [0, 2, 4].map((i) => makeCandle(sinceTimestamp + i * MS_PER_MINUTE));
  await PersistCandleAdapter.writeCandlesData(partialCandles, "BTCUSDT-partial", "1m", "binance-cache-3");

  const result = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-partial",
    "1m",
    "binance-cache-3",
    limit,
    sinceTimestamp,
    untilTimestamp,
  );

  if (result === null) {
    pass("readCandlesData returns null when cache is incomplete");
    return;
  }

  fail(`Expected null for incomplete cache, got ${result.length} candles`);
});

test("PersistCandleAdapter: readCandlesData preserves candle values", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp = new Date("2024-04-01T00:00:00Z").getTime();
  const limit = 3;
  const untilTimestamp = sinceTimestamp + limit * MS_PER_MINUTE;

  const prices = [51000, 52000, 53000];
  const candles = prices.map((price, i) => makeCandle(sinceTimestamp + i * MS_PER_MINUTE, price));

  await PersistCandleAdapter.writeCandlesData(candles, "BTCUSDT-values", "1m", "binance-cache-4");

  const result = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-values",
    "1m",
    "binance-cache-4",
    limit,
    sinceTimestamp,
    untilTimestamp,
  );

  if (!Array.isArray(result)) {
    fail("Expected array");
    return;
  }

  for (let i = 0; i < limit; i++) {
    if (result[i].timestamp !== candles[i].timestamp) {
      fail(`Timestamp mismatch at [${i}]: expected ${candles[i].timestamp}, got ${result[i].timestamp}`);
      return;
    }
    if (result[i].open !== prices[i]) {
      fail(`Price mismatch at [${i}]: expected ${prices[i]}, got ${result[i].open}`);
      return;
    }
  }

  pass("Candle values are preserved after write/read cycle");
});

test("PersistCandleAdapter: writeCandlesData is idempotent (no duplicate writes)", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp = new Date("2024-05-01T00:00:00Z").getTime();
  const limit = 3;
  const untilTimestamp = sinceTimestamp + limit * MS_PER_MINUTE;

  const candles = [];
  for (let i = 0; i < limit; i++) {
    candles.push(makeCandle(sinceTimestamp + i * MS_PER_MINUTE, 60000));
  }

  // Write same candles twice
  await PersistCandleAdapter.writeCandlesData(candles, "BTCUSDT-idem", "1m", "binance-cache-5");
  await PersistCandleAdapter.writeCandlesData(candles, "BTCUSDT-idem", "1m", "binance-cache-5");

  const result = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-idem",
    "1m",
    "binance-cache-5",
    limit,
    sinceTimestamp,
    untilTimestamp,
  );

  if (!Array.isArray(result) || result.length !== limit) {
    fail(`Expected ${limit} candles, got ${result?.length}`);
    return;
  }

  pass("Double write does not corrupt cache");
});

test("PersistCandleAdapter: different symbols use isolated caches", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp = new Date("2024-06-01T00:00:00Z").getTime();
  const limit = 2;
  const untilTimestamp = sinceTimestamp + limit * MS_PER_MINUTE;

  const btcCandles = [0, 1].map((i) => makeCandle(sinceTimestamp + i * MS_PER_MINUTE, 50000));
  const ethCandles = [0, 1].map((i) => makeCandle(sinceTimestamp + i * MS_PER_MINUTE, 3000));

  await PersistCandleAdapter.writeCandlesData(btcCandles, "BTCUSDT-iso", "1m", "binance-cache-6");
  await PersistCandleAdapter.writeCandlesData(ethCandles, "ETHUSDT-iso", "1m", "binance-cache-6");

  const btcResult = await PersistCandleAdapter.readCandlesData("BTCUSDT-iso", "1m", "binance-cache-6", limit, sinceTimestamp, untilTimestamp);
  const ethResult = await PersistCandleAdapter.readCandlesData("ETHUSDT-iso", "1m", "binance-cache-6", limit, sinceTimestamp, untilTimestamp);

  if (!Array.isArray(btcResult) || !Array.isArray(ethResult)) {
    fail("One or both symbol results are null");
    return;
  }

  if (btcResult[0].open !== 50000) {
    fail(`BTC open price expected 50000, got ${btcResult[0].open}`);
    return;
  }

  if (ethResult[0].open !== 3000) {
    fail(`ETH open price expected 3000, got ${ethResult[0].open}`);
    return;
  }

  pass("BTCUSDT and ETHUSDT caches are isolated");
});

test("PersistCandleAdapter: different intervals use isolated caches", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp1m = new Date("2024-07-01T00:00:00Z").getTime();
  const since5m = sinceTimestamp1m;
  const limit = 2;

  const candles1m = [0, 1].map((i) => makeCandle(sinceTimestamp1m + i * MS_PER_MINUTE, 50000));
  const candles5m = [0, 1].map((i) => makeCandle(since5m + i * 5 * MS_PER_MINUTE, 50000));

  await PersistCandleAdapter.writeCandlesData(candles1m, "BTCUSDT-intv", "1m", "binance-cache-7");
  await PersistCandleAdapter.writeCandlesData(candles5m, "BTCUSDT-intv", "5m", "binance-cache-7");

  const result1m = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-intv", "1m", "binance-cache-7", limit, sinceTimestamp1m, sinceTimestamp1m + limit * MS_PER_MINUTE,
  );
  const result5m = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-intv", "5m", "binance-cache-7", limit, since5m, since5m + limit * 5 * MS_PER_MINUTE,
  );

  if (!Array.isArray(result1m)) {
    fail("1m result is null");
    return;
  }

  if (!Array.isArray(result5m)) {
    fail("5m result is null");
    return;
  }

  if (result1m[1].timestamp !== sinceTimestamp1m + MS_PER_MINUTE) {
    fail(`1m second candle timestamp wrong: ${result1m[1].timestamp}`);
    return;
  }

  if (result5m[1].timestamp !== since5m + 5 * MS_PER_MINUTE) {
    fail(`5m second candle timestamp wrong: ${result5m[1].timestamp}`);
    return;
  }

  pass("1m and 5m interval caches are isolated");
});

test("PersistCandleAdapter: readCandlesData returns null when requesting more than cached", async ({ pass, fail }) => {
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  const sinceTimestamp = new Date("2024-08-01T00:00:00Z").getTime();
  const cachedLimit = 3;
  const requestedLimit = 5;
  const untilTimestamp = sinceTimestamp + requestedLimit * MS_PER_MINUTE;

  const candles = [];
  for (let i = 0; i < cachedLimit; i++) {
    candles.push(makeCandle(sinceTimestamp + i * MS_PER_MINUTE));
  }

  await PersistCandleAdapter.writeCandlesData(candles, "BTCUSDT-more", "1m", "binance-cache-8");

  const result = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-more",
    "1m",
    "binance-cache-8",
    requestedLimit,
    sinceTimestamp,
    untilTimestamp,
  );

  if (result === null) {
    pass("readCandlesData returns null when requesting more candles than cached");
    return;
  }

  fail(`Expected null when requesting ${requestedLimit} but only ${cachedLimit} cached, got ${result.length}`);
});

test("PersistCandleAdapter: useDummy makes cache always return null", async ({ pass, fail }) => {
  PersistCandleAdapter.useDummy();

  const sinceTimestamp = new Date("2024-09-01T00:00:00Z").getTime();
  const limit = 3;
  const untilTimestamp = sinceTimestamp + limit * MS_PER_MINUTE;

  const candles = [];
  for (let i = 0; i < limit; i++) {
    candles.push(makeCandle(sinceTimestamp + i * MS_PER_MINUTE));
  }

  await PersistCandleAdapter.writeCandlesData(candles, "BTCUSDT-dummy", "1m", "binance-cache-9");

  const result = await PersistCandleAdapter.readCandlesData(
    "BTCUSDT-dummy",
    "1m",
    "binance-cache-9",
    limit,
    sinceTimestamp,
    untilTimestamp,
  );

  // Restore to memory adapter for subsequent tests
  PersistCandleAdapter.usePersistCandleAdapter(PersistMemory);

  if (result === null) {
    pass("useDummy adapter discards writes, reads always return null");
    return;
  }

  fail(`Expected null from dummy adapter, got ${result.length} candles`);
});
