---
title: docs/api-reference/class/PartialUtils
group: docs
---

# PartialUtils

Utility class for accessing partial profit/loss reports and statistics.

Provides static-like methods (via singleton instance) to retrieve data
accumulated by PartialMarkdownService from partial profit/loss events.

Features:
- Statistical data extraction (total profit/loss events count)
- Markdown report generation with event tables
- File export to disk

Data source:
- PartialMarkdownService listens to partialProfitSubject/partialLossSubject
- Accumulates events in ReportStorage (max 250 events per symbol)
- Events include: timestamp, action, symbol, signalId, position, level, price, mode

## Constructor

```ts
constructor();
```

## Properties

### getData

```ts
getData: (symbol: string) => Promise<PartialStatistics>
```

Retrieves statistical data from accumulated partial profit/loss events.

Delegates to PartialMarkdownService.getData() which reads from ReportStorage.
Returns aggregated metrics calculated from all profit and loss events.

### getReport

```ts
getReport: (symbol: string) => Promise<string>
```

Generates markdown report with all partial profit/loss events for a symbol.

Creates formatted table containing:
- Action (PROFIT/LOSS)
- Symbol
- Signal ID
- Position (LONG/SHORT)
- Level % (+10%, -20%, etc)
- Current Price
- Timestamp (ISO 8601)
- Mode (Backtest/Live)

Also includes summary statistics at the end.

### dump

```ts
dump: (symbol: string, path?: string) => Promise<void>
```

Generates and saves markdown report to file.

Creates directory if it doesn't exist.
Filename format: {symbol}.md (e.g., "BTCUSDT.md")

Delegates to PartialMarkdownService.dump() which:
1. Generates markdown report via getReport()
2. Creates output directory (recursive mkdir)
3. Writes file with UTF-8 encoding
4. Logs success/failure to console
