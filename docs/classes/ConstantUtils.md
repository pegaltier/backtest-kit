---
title: docs/api-reference/class/ConstantUtils
group: docs
---

# ConstantUtils

Utility class containing predefined trading constants for take-profit and stop-loss levels.

Based on Kelly Criterion with exponential risk decay.
Values represent percentage of distance traveled towards final TP/SL target.

Example: If final TP is at +10% profit:
- TP_LEVEL1 (30) triggers when price reaches 30% of distance = +3% profit
- TP_LEVEL2 (60) triggers when price reaches 60% of distance = +6% profit
- TP_LEVEL3 (90) triggers when price reaches 90% of distance = +9% profit

## Constructor

```ts
constructor();
```

## Properties

### TP_LEVEL1

```ts
TP_LEVEL1: 30
```

Take Profit Level 1 (Kelly-optimized early partial).
Triggers at 30% of distance to final TP target.
Lock in profit early, let rest run.

### TP_LEVEL2

```ts
TP_LEVEL2: 60
```

Take Profit Level 2 (Kelly-optimized mid partial).
Triggers at 60% of distance to final TP target.
Secure majority of position while trend continues.

### TP_LEVEL3

```ts
TP_LEVEL3: 90
```

Take Profit Level 3 (Kelly-optimized final partial).
Triggers at 90% of distance to final TP target.
Near-complete exit, minimal exposure remains.

### SL_LEVEL1

```ts
SL_LEVEL1: 40
```

Stop Loss Level 1 (Kelly-optimized early warning).
Triggers at 40% of distance to final SL target.
Reduce exposure when setup weakens.

### SL_LEVEL2

```ts
SL_LEVEL2: 80
```

Stop Loss Level 2 (Kelly-optimized final exit).
Triggers at 80% of distance to final SL target.
Exit remaining position before catastrophic loss.
