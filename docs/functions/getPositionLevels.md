---
title: docs/function/getPositionLevels
group: docs
---

# getPositionLevels

```ts
declare function getPositionLevels(symbol: string): Promise<number[] | null>;
```

Returns the list of DCA entry prices for the current pending signal.

The first element is always the original priceOpen (initial entry).
Each subsequent element is a price added by commitAverageBuy().

Returns null if no pending signal exists.
Returns a single-element array [priceOpen] if no DCA entries were made.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
