---
title: docs/interface/BreakevenCommit
group: docs
---

# BreakevenCommit

Breakeven event.

## Properties

### action

```ts
action: "breakeven"
```

Discriminator for breakeven action

### currentPrice

```ts
currentPrice: number
```

Current market price at time of breakeven adjustment

### position

```ts
position: "long" | "short"
```

Trade direction: "long" (buy) or "short" (sell)

### priceOpen

```ts
priceOpen: number
```

Entry price for the position

### priceTakeProfit

```ts
priceTakeProfit: number
```

Effective take profit price (may differ from original after trailing)

### priceStopLoss

```ts
priceStopLoss: number
```

Effective stop loss price (set to priceOpen by breakeven action)

### originalPriceTakeProfit

```ts
originalPriceTakeProfit: number
```

Original take profit price before any trailing adjustments

### originalPriceStopLoss

```ts
originalPriceStopLoss: number
```

Original stop loss price before any trailing adjustments

### scheduledAt

```ts
scheduledAt: number
```

Signal creation timestamp in milliseconds

### pendingAt

```ts
pendingAt: number
```

Position activation timestamp in milliseconds (when price reached priceOpen)
