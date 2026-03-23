---
title: docs/function/readMemory
group: docs
---

# readMemory

```ts
declare function readMemory<T extends object = object>(dto: {
    bucketName: string;
    memoryId: string;
}): Promise<T | null>;
```

Reads a value from memory scoped to the current signal.

Reads symbol from execution context and signalId from the active pending signal.
If no pending signal exists, logs a warning and returns null.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
