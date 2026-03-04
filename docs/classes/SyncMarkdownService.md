---
title: docs/class/SyncMarkdownService
group: docs
---

# SyncMarkdownService

Service for generating and saving signal sync markdown reports.

Features:
- Listens to signal sync events via syncSubject (signal-open and signal-close)
- Accumulates all sync events per symbol-strategy-exchange-frame-backtest combination
- Generates markdown tables with detailed signal lifecycle information
- Provides statistics (total events, opens, closes)
- Saves reports to disk in dump/sync/

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### getStorage

```ts
getStorage: any
```

### subscribe

```ts
subscribe: (() => () => void) & ISingleshotClearable
```

### unsubscribe

```ts
unsubscribe: () => Promise<void>
```

### tick

```ts
tick: any
```

### getData

```ts
getData: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean) => Promise<SyncStatisticsModel>
```

### getReport

```ts
getReport: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean, columns?: Columns$2[]) => Promise<string>
```

### dump

```ts
dump: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean, path?: string, columns?: Columns$2[]) => Promise<void>
```

### clear

```ts
clear: (payload?: { symbol: string; strategyName: string; exchangeName: string; frameName: string; backtest: boolean; }) => Promise<void>
```
