---
title: docs/class/SyncUtils
group: docs
---

# SyncUtils

Utility class for accessing signal sync lifecycle reports and statistics.

Provides methods to retrieve data accumulated by SyncMarkdownService
from signal-open and signal-close events emitted via syncSubject.

Features:
- Statistical data extraction (total events, opens, closes)
- Markdown report generation with event tables
- File export to disk

Data source:
- SyncMarkdownService listens to syncSubject
- Accumulates sync events in ReportStorage (max 250 events per combination)
- Events include: signal-open (limit order filled) and signal-close (position exited)

## Constructor

```ts
constructor();
```

## Properties

### getData

```ts
getData: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean) => Promise<SyncStatisticsModel>
```

Retrieves statistical data from accumulated signal sync events.

Delegates to SyncMarkdownService.getData() which reads from ReportStorage.
Returns aggregated metrics calculated from all sync events.

### getReport

```ts
getReport: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean, columns?: Columns$3[]) => Promise<string>
```

Generates markdown report with all signal sync events for a symbol-strategy pair.

Creates formatted table containing:
- Symbol, strategy, signal ID
- Action (signal-open / signal-close)
- Position direction, current price, entry price
- Take profit and stop loss levels
- DCA entry count, partial close count
- PNL percentage, close reason (for signal-close)
- Timestamp and mode (backtest/live)

### dump

```ts
dump: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean, path?: string, columns?: Columns$3[]) => Promise<void>
```

Generates and saves markdown report to file.

Creates directory if it doesn't exist.
Filename format: {symbol}_{strategyName}_{exchangeName}[_{frameName}_backtest&vert;_live]-{timestamp}.md
