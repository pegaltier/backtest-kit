---
title: docs/api-reference/class/LiveGlobalService
group: docs
---

# LiveGlobalService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### liveLogicPublicService

```ts
liveLogicPublicService: any
```

### run

```ts
run: (symbol: string, context: { strategyName: string; exchangeName: string; }) => AsyncGenerator<IStrategyTickResultOpened | IStrategyTickResultClosed, void, unknown>
```
