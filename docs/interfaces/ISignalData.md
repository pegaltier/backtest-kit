---
title: docs/api-reference/interface/ISignalData
group: docs
---

# ISignalData

Signal data stored in persistence layer.
Contains nullable signal for atomic updates.

## Properties

### signalRow

```ts
signalRow: ISignalRow
```

Current signal state (null when no active signal)
