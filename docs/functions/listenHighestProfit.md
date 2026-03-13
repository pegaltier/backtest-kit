---
title: docs/function/listenHighestProfit
group: docs
---

# listenHighestProfit

```ts
declare function listenHighestProfit(fn: (event: HighestProfitContract) => void): () => void;
```

Subscribes to highest profit events with queued async processing.
Emits when a signal reaches a new highest profit level during its lifecycle.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.
Useful for tracking profit milestones and implementing dynamic management logic.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle highest profit events |
