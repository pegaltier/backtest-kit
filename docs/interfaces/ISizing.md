---
title: docs/interface/ISizing
group: docs
---

# ISizing

Sizing interface for position size calculation.
Used internally by strategy execution.

## Properties

### calculate

```ts
calculate: (params: ISizingCalculateParams) => Promise<number>
```

Calculates position size based on risk parameters.
