---
title: docs/api-reference/interface/IStrategySchema
group: docs
---

# IStrategySchema

## Properties

### strategyName

```ts
strategyName: string
```

### interval

```ts
interval: SignalInterval
```

### getSignal

```ts
getSignal: (symbol: string) => Promise<ISignalDto>
```

### callbacks

```ts
callbacks: Partial<IStrategyCallbacks>
```
