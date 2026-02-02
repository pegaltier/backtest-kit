---
title: docs/interface/PartialProfitAvailableNotification
group: docs
---

# PartialProfitAvailableNotification

Partial profit notification.
Emitted when signal reaches profit level milestone (10%, 20%, etc).

## Properties

### type

```ts
type: "partial_profit.available"
```

Discriminator for type-safe union

### id

```ts
id: string
```

Unique notification identifier

### timestamp

```ts
timestamp: number
```

Unix timestamp in milliseconds when partial profit level was reached

### backtest

```ts
backtest: boolean
```

Whether this notification is from backtest mode (true) or live mode (false)

### symbol

```ts
symbol: string
```

Trading pair symbol (e.g., "BTCUSDT")

### strategyName

```ts
strategyName: string
```

Strategy name that generated this signal

### exchangeName

```ts
exchangeName: string
```

Exchange name where signal was executed

### signalId

```ts
signalId: string
```

Unique signal identifier (UUID v4)

### level

```ts
level: PartialLevel
```

Profit level milestone reached (10, 20, 30, etc)

### currentPrice

```ts
currentPrice: number
```

Current market price when milestone was reached

### priceOpen

```ts
priceOpen: number
```

Entry price for the position

### position

```ts
position: "long" | "short"
```

Trade direction: "long" (buy) or "short" (sell)

### priceTakeProfit

```ts
priceTakeProfit: number
```

Effective take profit price (with trailing if set)

### priceStopLoss

```ts
priceStopLoss: number
```

Effective stop loss price (with trailing if set)

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

Signal creation timestamp in milliseconds (when signal was first created/scheduled)

### pendingAt

```ts
pendingAt: number
```

Pending timestamp in milliseconds (when position became pending/active at priceOpen)

### createdAt

```ts
createdAt: number
```

Unix timestamp in milliseconds when the notification was created
