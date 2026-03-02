---
title: docs/function/getPositionPartials
group: docs
---

# getPositionPartials

```ts
declare function getPositionPartials(symbol: string): Promise<{
    type: "profit" | "loss";
    percent: number;
    currentPrice: number;
    effectivePrice: number;
    entryCountAtClose: number;
    debugTimestamp?: number;
}[]>;
```

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | |
