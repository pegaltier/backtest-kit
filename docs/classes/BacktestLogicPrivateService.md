---
title: docs/api-reference/class/BacktestLogicPrivateService
group: docs
---

# BacktestLogicPrivateService

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

### frameGlobalService

```ts
frameGlobalService: any
```

## Methods

### run

```ts
run(symbol: string): AsyncGenerator<IStrategyTickResultClosed, void, unknown>;
```
