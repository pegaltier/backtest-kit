---
title: docs/api-reference/type/PartialLevel
group: docs
---

# PartialLevel

```ts
type PartialLevel = 10 | 20 | 30 | 40 | 50 | 60 | 70 | 80 | 90 | 100;
```

Profit or loss level milestone in percentage points.
Represents 10%, 20%, 30%, ..., 100% profit or loss thresholds.

Used to track when a signal reaches specific profit/loss milestones.
Each level is emitted only once per signal (deduplication via Set).
