---
title: docs/api-reference/type/RiskData
group: docs
---

# RiskData

```ts
type RiskData = Array<[
    string,
    IRiskActivePosition
]>;
```

Type for persisted risk positions data.
Stores Map entries as array of [key, value] tuples for JSON serialization.
