---
title: docs/api-reference/class/LiveLogicPrivateService
group: docs
---

# LiveLogicPrivateService

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

## Methods

### run

```ts
run(symbol: string): AsyncGenerator<IStrategyTickResultOpened | IStrategyTickResultClosed, void, unknown>;
```
