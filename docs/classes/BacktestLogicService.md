---
title: docs/api-reference/class/BacktestLogicService
group: docs
---

# BacktestLogicService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### strategyGlobalService

```ts
strategyGlobalService: any
```

### exchangeGlobalService

```ts
exchangeGlobalService: any
```

### run

```ts
run: (symbol: string, timeframes: Date[]) => Promise<IStrategyTickResultClosed[]>
```
