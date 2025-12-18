---
title: docs/class/PositionSizeUtils
group: docs
---

# PositionSizeUtils

Utility class for position sizing calculations.

Provides static methods for each sizing method with validation.
Each method validates that the sizing schema matches the requested method.

## Constructor

```ts
constructor();
```

## Properties

### fixedPercentage

```ts
fixedPercentage: (symbol: string, accountBalance: number, priceOpen: number, priceStopLoss: number, context: { sizingName: string; }) => Promise<number>
```

Calculates position size using fixed percentage risk method.

### kellyCriterion

```ts
kellyCriterion: (symbol: string, accountBalance: number, priceOpen: number, winRate: number, winLossRatio: number, context: { sizingName: string; }) => Promise<number>
```

Calculates position size using Kelly Criterion method.

### atrBased

```ts
atrBased: (symbol: string, accountBalance: number, priceOpen: number, atr: number, context: { sizingName: string; }) => Promise<number>
```

Calculates position size using ATR-based method.
