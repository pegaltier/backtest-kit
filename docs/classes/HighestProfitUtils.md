---
title: docs/class/HighestProfitUtils
group: docs
---

# HighestProfitUtils

Utility class for accessing highest profit reports and statistics.

Provides static-like methods (via singleton instance) to retrieve data
accumulated by HighestProfitMarkdownService from highestProfitSubject events.

## Constructor

```ts
constructor();
```

## Properties

### getData

```ts
getData: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean) => Promise<HighestProfitStatisticsModel>
```

Retrieves statistical data from accumulated highest profit events.

### getReport

```ts
getReport: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean, columns?: Columns$4[]) => Promise<string>
```

Generates a markdown report with all highest profit events for a symbol-strategy pair.

### dump

```ts
dump: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean, path?: string, columns?: Columns$4[]) => Promise<void>
```

Generates and saves a markdown report to file.
