---
title: docs/interface/IStorageSignalRow
group: docs
---

# IStorageSignalRow

Storage signal row with creation timestamp taken from IStrategyTickResult.
Used for persisting signals with accurate creation time.

## Properties

### updatedAt

```ts
updatedAt: number
```

Creation timestamp taken from IStrategyTickResult

### status

```ts
status: "opened" | "scheduled" | "closed" | "cancelled"
```

Current status of the signal
