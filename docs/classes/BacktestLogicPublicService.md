---
title: docs/api-reference/class/BacktestLogicPublicService
group: docs
---

# BacktestLogicPublicService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### backtestLogicPrivateService

```ts
backtestLogicPrivateService: any
```

### run

```ts
run: (symbol: string, context: { strategyName: string; exchangeName: string; frameName: string; }) => AsyncGenerator<IStrategyTickResultClosed, void, unknown>
```
