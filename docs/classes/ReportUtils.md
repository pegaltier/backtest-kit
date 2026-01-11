---
title: docs/class/ReportUtils
group: docs
---

# ReportUtils

Utility class for managing report services.

Provides methods to enable/disable JSONL event logging across
different service types (backtest, live, walker, performance, etc.).

Typically extended by ReportAdapter for additional functionality.

## Constructor

```ts
constructor();
```

## Properties

### enable

```ts
enable: ({ backtest: bt, breakeven, heat, live, partial, performance, risk, schedule, walker, }?: Partial<IReportTarget>) => (...args: any[]) => any
```

Enables report services selectively.

Subscribes to specified report services and returns a cleanup function
that unsubscribes from all enabled services at once.

Each enabled service will:
- Start listening to relevant events
- Write events to JSONL files in real-time
- Include metadata for filtering and analytics

IMPORTANT: Always call the returned unsubscribe function to prevent memory leaks.
