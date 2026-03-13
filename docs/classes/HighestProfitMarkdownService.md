---
title: docs/class/HighestProfitMarkdownService
group: docs
---

# HighestProfitMarkdownService

Service for generating and saving highest profit markdown reports.

Listens to highestProfitSubject and accumulates events per
symbol-strategy-exchange-frame combination. Provides getData(),
getReport(), and dump() methods matching the Partial pattern.

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
getData: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean) => Promise<HighestProfitStatisticsModel>
```

### getReport

```ts
getReport: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean, columns?: Columns$4[]) => Promise<string>
```

### dump

```ts
dump: (symbol: string, strategyName: string, exchangeName: string, frameName: string, backtest: boolean, path?: string, columns?: Columns$4[]) => Promise<void>
```

### clear

```ts
clear: (payload?: { symbol: string; strategyName: string; exchangeName: string; frameName: string; backtest: boolean; }) => Promise<void>
```
