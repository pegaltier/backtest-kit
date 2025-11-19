---
title: docs/api-reference/class/StrategyPublicService
group: docs
---

# StrategyPublicService

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
