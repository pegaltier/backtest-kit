---
title: docs/api-reference/function/listenError
group: docs
---

# listenError

```ts
declare function listenError(fn: (error: Error) => void): () => void;
```

Subscribes to recoverable execution errors with queued async processing.

Listens to recoverable errors during strategy execution (e.g., failed API calls).
These errors are caught and handled gracefully - execution continues.
Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle error events |
