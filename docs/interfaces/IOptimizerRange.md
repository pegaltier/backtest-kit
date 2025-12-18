---
title: docs/interface/IOptimizerRange
group: docs
---

# IOptimizerRange

Time range configuration for optimizer training or testing periods.
Used to define date boundaries for data collection.

## Properties

### note

```ts
note: string
```

Optional description of this time range.
Example: "Bull market period 2024-Q1"

### startDate

```ts
startDate: Date
```

Start date of the range (inclusive).

### endDate

```ts
endDate: Date
```

End date of the range (inclusive).
