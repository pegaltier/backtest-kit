---
title: docs/function/dumpJson
group: docs
---

# dumpJson

```ts
declare function dumpJson(dto: {
    bucketName: string;
    dumpId: string;
    json: object;
    description: string;
}): Promise<void>;
```

Dumps an arbitrary nested object as a fenced JSON block scoped to the current signal.

Reads signalId from the active pending signal via execution and method context.
If no pending signal exists, logs a warning and returns without writing.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
