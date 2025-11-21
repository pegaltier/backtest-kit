---
title: docs/api-reference/function/listenSignalLive
group: docs
---

# listenSignalLive

```ts
declare function listenSignalLive(fn: (event: IStrategyTickResult) => void): () => void;
```

Subscribes to live trading signal events with queued async processing.

Only receives events from Live.run() execution.
Events are processed sequentially in order received.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle live signal events |
