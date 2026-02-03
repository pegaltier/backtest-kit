---
title: docs/function/commitActivateScheduled
group: docs
---

# commitActivateScheduled

```ts
declare function commitActivateScheduled(symbol: string, activateId?: string): Promise<void>;
```

Activates a scheduled signal early without waiting for price to reach priceOpen.

Sets the activation flag on the scheduled signal. The actual activation
happens on the next tick() when strategy detects the flag.

Automatically detects backtest/live mode from execution context.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `symbol` | Trading pair symbol |
| `activateId` | Optional activation ID for tracking user-initiated activations |
