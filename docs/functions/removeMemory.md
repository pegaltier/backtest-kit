---
title: docs/function/removeMemory
group: docs
---

# removeMemory

```ts
declare function removeMemory(dto: {
    bucketName: string;
    memoryId: string;
}): Promise<void>;
```

Removes a memory entry for the current signal.

Reads symbol from execution context and signalId from the active pending signal.
If no pending signal exists, logs a warning and returns without removing.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
