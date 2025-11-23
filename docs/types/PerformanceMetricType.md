---
title: docs/api-reference/type/PerformanceMetricType
group: docs
---

# PerformanceMetricType

```ts
type PerformanceMetricType = "backtest_total" | "backtest_timeframe" | "backtest_signal" | "live_tick";
```

Performance metric types tracked by the system.

Backtest metrics:
- backtest_total: Total backtest duration from start to finish
- backtest_timeframe: Duration to process a single timeframe iteration
- backtest_signal: Duration to process a signal (tick + getNextCandles + backtest)

Live metrics:
- live_tick: Duration of a single live tick iteration
