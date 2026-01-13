---
title: docs/function/getOrderBook
group: docs
---

# getOrderBook

```ts
declare function getOrderBook(symbol: string, depth?: number): Promise<IOrderBookData>;
```

Fetches order book for a trading pair from the registered exchange.

Uses current execution context to determine timing. The underlying exchange
implementation receives time range parameters but may use them (backtest)
or ignore them (live trading).

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol (e.g., "BTCUSDT") |
| `depth` | Maximum depth levels (default: CC_ORDER_BOOK_MAX_DEPTH_LEVELS) |
