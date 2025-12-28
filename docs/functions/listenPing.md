---
title: docs/function/listenPing
group: docs
---

# listenPing

```ts
declare function listenPing(fn: (event: PingContract) => void): () => void;
```

Subscribes to ping events during scheduled signal monitoring with queued async processing.

Events are emitted every minute when a scheduled signal is being monitored (waiting for activation).
Allows tracking of scheduled signal lifecycle and custom monitoring logic.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle ping events |
