---
title: docs/type/IStrategyBacktestResult
group: docs
---

# IStrategyBacktestResult

```ts
type IStrategyBacktestResult = IStrategyTickResultOpened | IStrategyTickResultScheduled | IStrategyTickResultClosed | IStrategyTickResultCancelled;
```

Backtest returns closed result (TP/SL or time_expired) or cancelled result (scheduled signal never activated).
