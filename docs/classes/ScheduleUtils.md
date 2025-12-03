---
title: docs/api-reference/class/ScheduleUtils
group: docs
---

# ScheduleUtils

Utility class for scheduled signals reporting operations.

Provides simplified access to scheduleMarkdownService with logging.
Exported as singleton instance for convenient usage.

Features:
- Track scheduled signals in queue
- Track cancelled signals
- Calculate cancellation rate and average wait time
- Generate markdown reports

## Constructor

```ts
constructor();
```

## Properties

### getData

```ts
getData: (symbol: string, strategyName: string) => Promise<ScheduleStatistics>
```

Gets statistical data from all scheduled signal events for a symbol-strategy pair.

### getReport

```ts
getReport: (symbol: string, strategyName: string) => Promise<string>
```

Generates markdown report with all scheduled events for a symbol-strategy pair.

### dump

```ts
dump: (strategyName: string, path?: string) => Promise<void>
```

Saves strategy report to disk.
