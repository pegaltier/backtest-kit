---
title: docs/api-reference/class/StrategyGlobalService
group: docs
---

# StrategyGlobalService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### strategyConnectionService

```ts
strategyConnectionService: any
```

### tick

```ts
tick: (symbol: string, when: Date, backtest: boolean) => Promise<IStrategyTickResult>
```

### backtest

```ts
backtest: (symbol: string, candles: ICandleData[], when: Date, backtest: boolean) => Promise<IStrategyTickResultClosed>
```
