---
title: docs/function/dumpTable
group: docs
---

# dumpTable

```ts
declare function dumpTable(dto: {
    bucketName: string;
    dumpId: string;
    rows: Record<string, unknown>[];
    description: string;
}): Promise<void>;
```

Dumps an array of objects as a table scoped to the current signal.

Reads signalId from the active pending signal via execution and method context.
If no pending signal exists, logs a warning and returns without writing.

Column headers are derived from the union of all keys across all rows.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
