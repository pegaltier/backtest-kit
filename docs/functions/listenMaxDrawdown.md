---
title: docs/function/listenMaxDrawdown
group: docs
---

# listenMaxDrawdown

```ts
declare function listenMaxDrawdown(fn: (event: MaxDrawdownContract) => void): () => void;
```

Subscribes to max drawdown events with queued async processing.
Emits when a signal reaches a new maximum drawdown level during its lifecycle.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.
Useful for tracking drawdown milestones and implementing dynamic risk management logic.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle max drawdown events |
