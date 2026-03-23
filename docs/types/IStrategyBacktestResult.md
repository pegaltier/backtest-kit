---
title: docs/type/IStrategyBacktestResult
group: docs
---

# IStrategyBacktestResult

```ts
type IStrategyBacktestResult = IStrategyTickResultOpened | IStrategyTickResultScheduled | IStrategyTickResultActive | IStrategyTickResultClosed | IStrategyTickResultCancelled;
```

Backtest returns closed result (TP/SL or time_expired), cancelled result (scheduled signal never activated),
or active result (candles exhausted but signal still open — only for minuteEstimatedTime = Infinity).
