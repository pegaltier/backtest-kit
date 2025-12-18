---
title: docs/function/addSizing
group: docs
---

# addSizing

```ts
declare function addSizing(sizingSchema: ISizingSchema): void;
```

Registers a position sizing configuration in the framework.

The sizing configuration defines:
- Position sizing method (fixed-percentage, kelly-criterion, atr-based)
- Risk parameters (risk percentage, Kelly multiplier, ATR multiplier)
- Position constraints (min/max size, max position percentage)
- Callback for calculation events

## Parameters

| Parameter | Description |
|-----------|-------------|
| `sizingSchema` | Sizing configuration object (discriminated union) |
