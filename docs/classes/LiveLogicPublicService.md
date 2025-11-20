---
title: docs/api-reference/class/LiveLogicPublicService
group: docs
---

# LiveLogicPublicService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### liveLogicPrivateService

```ts
liveLogicPrivateService: any
```

### run

```ts
run: (symbol: string, context: { strategyName: string; exchangeName: string; }) => AsyncGenerator<IStrategyTickResultOpened | IStrategyTickResultClosed, void, unknown>
```
