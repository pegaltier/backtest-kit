---
title: docs/api-reference/interface/IPartialData
group: docs
---

# IPartialData

Serializable partial data for persistence layer.
Converts Sets to arrays for JSON serialization.

Stored in PersistPartialAdapter as Record&lt;signalId, IPartialData&gt;.
Loaded on initialization and converted back to IPartialState.

## Properties

### profitLevels

```ts
profitLevels: PartialLevel[]
```

Array of profit levels that have been reached for this signal.
Serialized form of IPartialState.profitLevels Set.

### lossLevels

```ts
lossLevels: PartialLevel[]
```

Array of loss levels that have been reached for this signal.
Serialized form of IPartialState.lossLevels Set.
