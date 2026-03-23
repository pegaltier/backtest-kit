---
title: docs/function/dumpText
group: docs
---

# dumpText

```ts
declare function dumpText(dto: {
    bucketName: string;
    dumpId: string;
    content: string;
    description: string;
}): Promise<void>;
```

Dumps raw text content scoped to the current signal.

Reads signalId from the active pending signal via execution and method context.
If no pending signal exists, logs a warning and returns without writing.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
