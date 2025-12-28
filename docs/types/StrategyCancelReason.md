---
title: docs/type/StrategyCancelReason
group: docs
---

# StrategyCancelReason

```ts
type StrategyCancelReason = "timeout" | "price_reject" | "user";
```

Reason why scheduled signal was cancelled.
Used in discriminated union for type-safe handling.
