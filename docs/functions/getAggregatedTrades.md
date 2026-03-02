---
title: docs/function/getAggregatedTrades
group: docs
---

# getAggregatedTrades

```ts
declare function getAggregatedTrades(symbol: string, limit?: number): Promise<IAggregatedTradeData[]>;
```

Fetches aggregated trades for a trading pair from the registered exchange.

Trades are fetched backwards from the current execution context time.
If limit is not specified, returns all trades within one CC_AGGREGATED_TRADES_MAX_MINUTES window.
If limit is specified, paginates backwards until at least limit trades are collected.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol (e.g., "BTCUSDT") |
| `limit` | Optional maximum number of trades to fetch |
