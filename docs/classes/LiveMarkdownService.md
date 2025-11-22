---
title: docs/api-reference/class/LiveMarkdownService
group: docs
---

# LiveMarkdownService

Service for generating and saving live trading markdown reports.

Features:
- Listens to all signal events via onTick callback
- Accumulates all events (idle, opened, active, closed) per strategy
- Generates markdown tables with detailed event information
- Provides trading statistics (win rate, average PNL)
- Saves reports to disk in logs/live/{strategyName}.md

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

Logger service for debug output

### getStorage

```ts
getStorage: any
```

Memoized function to get or create ReportStorage for a strategy.
Each strategy gets its own isolated storage instance.

### tick

```ts
tick: any
```

Processes tick events and accumulates all event types.
Should be called from IStrategyCallbacks.onTick.

Processes all event types: idle, opened, active, closed.

### getData

```ts
getData: (strategyName: string) => Promise<LiveStatistics>
```

Gets statistical data from all live trading events for a strategy.
Delegates to ReportStorage.getData().

### getReport

```ts
getReport: (strategyName: string) => Promise<string>
```

Generates markdown report with all events for a strategy.
Delegates to ReportStorage.getReport().

### dump

```ts
dump: (strategyName: string, path?: string) => Promise<void>
```

Saves strategy report to disk.
Creates directory if it doesn't exist.
Delegates to ReportStorage.dump().

### clear

```ts
clear: (strategyName?: string) => Promise<void>
```

Clears accumulated event data from storage.
If strategyName is provided, clears only that strategy's data.
If strategyName is omitted, clears all strategies' data.

### init

```ts
init: (() => Promise<void>) & ISingleshotClearable
```

Initializes the service by subscribing to live signal events.
Uses singleshot to ensure initialization happens only once.
Automatically called on first use.
