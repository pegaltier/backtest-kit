---
title: docs/function/dumpRecord
group: docs
---

# dumpRecord

```ts
declare function dumpRecord(dto: {
    bucketName: string;
    dumpId: string;
    record: Record<string, unknown>;
    description: string;
}): Promise<void>;
```

Dumps a flat key-value record scoped to the current signal.

Reads signalId from the active pending signal via execution and method context.
If no pending signal exists, logs a warning and returns without writing.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
