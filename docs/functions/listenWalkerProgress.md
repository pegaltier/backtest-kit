---
title: docs/api-reference/function/listenWalkerProgress
group: docs
---

# listenWalkerProgress

```ts
declare function listenWalkerProgress(fn: (event: ProgressWalkerContract) => void): () => void;
```

Subscribes to walker progress events with queued async processing.

Emits during Walker.run() execution after each strategy completes.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle walker progress events |
