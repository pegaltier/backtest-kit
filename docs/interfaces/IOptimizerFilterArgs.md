---
title: docs/api-reference/interface/IOptimizerFilterArgs
group: docs
---

# IOptimizerFilterArgs

Filter arguments for data source queries without pagination.
Used internally to filter data by symbol and time range.

## Properties

### symbol

```ts
symbol: string
```

Trading pair symbol (e.g., "BTCUSDT").

### startDate

```ts
startDate: Date
```

Start date of the data range (inclusive).

### endDate

```ts
endDate: Date
```

End date of the data range (inclusive).
