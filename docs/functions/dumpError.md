---
title: docs/function/dumpError
group: docs
---

# dumpError

```ts
declare function dumpError(dto: {
    bucketName: string;
    dumpId: string;
    content: string;
    description: string;
}): Promise<void>;
```

Dumps an error description scoped to the current signal.

Reads signalId from the active pending signal via execution and method context.
If no pending signal exists, logs a warning and returns without writing.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
