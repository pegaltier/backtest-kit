---
title: docs/class/ClientSizing
group: docs
---

# ClientSizing

Implements `ISizing`

Client implementation for position sizing calculation.

Features:
- Multiple sizing methods (fixed %, Kelly, ATR)
- Min/max position constraints
- Max position percentage limit
- Callback support for validation and logging

Used by strategy execution to determine optimal position sizes.

## Constructor

```ts
constructor(params: ISizingParams);
```

## Properties

### params

```ts
params: ISizingParams
```

## Methods

### calculate

```ts
calculate(params: ISizingCalculateParams): Promise<number>;
```

Calculates position size based on configured method and constraints.
