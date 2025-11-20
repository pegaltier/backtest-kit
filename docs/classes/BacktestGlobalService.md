---
title: docs/api-reference/class/BacktestGlobalService
group: docs
---

# BacktestGlobalService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### backtestLogicPublicService

```ts
backtestLogicPublicService: any
```

### run

```ts
run: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }) => AsyncGenerator<IStrategyTickResultClosed, void, unknown>
```
