---
title: docs/interface/TickEvent
group: docs
---

# TickEvent

Unified tick event data for report generation.
Contains all information about a tick event regardless of action type.

## Properties

### timestamp

```ts
timestamp: number
```

Event timestamp in milliseconds (pendingAt for opened/closed events)

### action

```ts
action: "idle" | "opened" | "active" | "closed"
```

Event action type

### symbol

```ts
symbol: string
```

Trading pair symbol (only for non-idle events)

### signalId

```ts
signalId: string
```

Signal ID (only for opened/active/closed)

### position

```ts
position: string
```

Position type (only for opened/active/closed)

### note

```ts
note: string
```

Signal note (only for opened/active/closed)

### currentPrice

```ts
currentPrice: number
```

Current price

### priceOpen

```ts
priceOpen: number
```

Open price (only for opened/active/closed)

### priceTakeProfit

```ts
priceTakeProfit: number
```

Take profit price (only for opened/active/closed)

### priceStopLoss

```ts
priceStopLoss: number
```

Stop loss price (only for opened/active/closed)

### originalPriceTakeProfit

```ts
originalPriceTakeProfit: number
```

Original take profit price before modifications (only for opened/active/closed)

### originalPriceStopLoss

```ts
originalPriceStopLoss: number
```

Original stop loss price before modifications (only for opened/active/closed)

### totalExecuted

```ts
totalExecuted: number
```

Total executed percentage from partial closes (only for opened/active/closed)

### percentTp

```ts
percentTp: number
```

Percentage progress towards take profit (only for active)

### percentSl

```ts
percentSl: number
```

Percentage progress towards stop loss (only for active)

### pnl

```ts
pnl: number
```

PNL percentage (for active: unrealized, for closed: realized)

### closeReason

```ts
closeReason: string
```

Close reason (only for closed)

### duration

```ts
duration: number
```

Duration in minutes (only for closed)
