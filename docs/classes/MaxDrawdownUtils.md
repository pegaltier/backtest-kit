---
title: docs/class/MaxDrawdownUtils
group: docs
---

# MaxDrawdownUtils

Utility class for accessing max drawdown reports and statistics.

Provides static-like methods (via singleton instance) to retrieve data
accumulated by MaxDrawdownMarkdownService from maxDrawdownSubject events.

## Constructor

```ts
constructor();
```

## Properties

### getData

```ts
getData: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean) => Promise<MaxDrawdownStatisticsModel>
```

Retrieves statistical data from accumulated max drawdown events.

### getReport

```ts
getReport: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean, columns?: Columns$4[]) => Promise<string>
```

Generates a markdown report with all max drawdown events for a symbol-strategy pair.

### dump

```ts
dump: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }, backtest?: boolean, path?: string, columns?: Columns$4[]) => Promise<void>
```

Generates and saves a markdown report to file.
