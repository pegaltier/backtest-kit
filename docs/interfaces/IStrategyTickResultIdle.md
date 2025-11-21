---
title: docs/api-reference/interface/IStrategyTickResultIdle
group: docs
---

# IStrategyTickResultIdle

Tick result: no active signal, idle state.

## Properties

### action

```ts
action: "idle"
```

Discriminator for type-safe union

### signal

```ts
signal: null
```

No signal in idle state

### strategyName

```ts
strategyName: string
```

Strategy name for tracking idle events

### exchangeName

```ts
exchangeName: string
```

Exchange name for tracking idle events

### currentPrice

```ts
currentPrice: number
```

Current VWAP price during idle state
