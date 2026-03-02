---
title: docs/interface/IAggregatedTradeData
group: docs
---

# IAggregatedTradeData

Aggregated trade data point.
Represents a single trade that has occurred, used for detailed analysis and backtesting.
Includes price, quantity, timestamp, and whether the buyer is the market maker (which can indicate trade direction).

## Properties

### id

```ts
id: string
```

Unique identifier for the aggregated trade

### price

```ts
price: number
```

Price at which the trade occurred

### qty

```ts
qty: number
```

Quantity traded

### timestamp

```ts
timestamp: number
```

Unix timestamp in milliseconds when the trade occurred

### isBuyerMaker

```ts
isBuyerMaker: boolean
```

Whether the buyer is the market maker (true if buyer is maker, false if seller is maker)
