---
title: docs/interface/IOptimizerData
group: docs
---

# IOptimizerData

Base interface for optimizer data sources.
All data fetched from sources must have a unique ID for deduplication.

## Properties

### id

```ts
id: RowId
```

Unique identifier for this data row.
Used for deduplication when paginating data sources.
