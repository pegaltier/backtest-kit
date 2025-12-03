---
title: docs/api-reference/class/ConstantUtils
group: docs
---

# ConstantUtils

Utility class containing predefined trading constants for take-profit and stop-loss levels.

Provides standardized percentage values based on Kelly Criterion with exponential risk decay.
These constants represent percentage levels relative to entry price.

## Constructor

```ts
constructor();
```

## Properties

### TP_LEVEL1

```ts
TP_LEVEL1: 100
```

Take Profit Level 1 (Kelly-optimized aggressive target).
Represents 100% profit from entry price.

### TP_LEVEL2

```ts
TP_LEVEL2: 50
```

Take Profit Level 2 (Kelly-optimized moderate target).
Represents 50% profit from entry price.

### TP_LEVEL3

```ts
TP_LEVEL3: 25
```

Take Profit Level 3 (Kelly-optimized conservative target).
Represents 25% profit from entry price.

### SL_LEVEL1

```ts
SL_LEVEL1: 100
```

Stop Loss Level 1 (Kelly-optimized maximum risk).
Represents 50% maximum acceptable loss from entry price.

### SL_LEVEL2

```ts
SL_LEVEL2: 50
```

Stop Loss Level 2 (Kelly-optimized standard stop).
Represents 25% maximum acceptable loss from entry price.
