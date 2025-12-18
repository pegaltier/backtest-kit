---
title: docs/function/listenPartialProfitOnce
group: docs
---

# listenPartialProfitOnce

```ts
declare function listenPartialProfitOnce(filterFn: (event: PartialProfitContract) => boolean, fn: (event: PartialProfitContract) => void): () => void;
```

Subscribes to filtered partial profit level events with one-time execution.

Listens for events matching the filter predicate, then executes callback once
and automatically unsubscribes. Useful for waiting for specific profit conditions.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `filterFn` | Predicate to filter which events trigger the callback |
| `fn` | Callback function to handle the filtered event (called only once) |
