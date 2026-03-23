---
title: docs/function/dumpAgentAnswer
group: docs
---

# dumpAgentAnswer

```ts
declare function dumpAgentAnswer(dto: {
    bucketName: string;
    dumpId: string;
    messages: MessageModel[];
    description: string;
}): Promise<void>;
```

Dumps the full agent message history scoped to the current signal.

Reads signalId from the active pending signal via execution and method context.
If no pending signal exists, logs a warning and returns without writing.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `dto` | |
