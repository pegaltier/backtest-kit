---
title: docs/function/listMemory
group: docs
---

# listMemory

```ts
declare function listMemory<T extends object = object>(dto: {
    bucketName: string;
}): Promise<Array<{
    memoryId: string;
    content: T;
}>>;
```

Lists all memory entries for the current signal.

Reads symbol from execution context and signalId from the active pending signal.
If no pending signal exists, logs a warning and returns an empty array.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
