---
title: docs/interface/ScheduledEvent
group: docs
---

# ScheduledEvent

Unified scheduled signal event data for report generation.
Contains all information about scheduled, opened and cancelled events.

## Properties

### timestamp

```ts
timestamp: number
```

Event timestamp in milliseconds (scheduledAt for scheduled/cancelled events)

### action

```ts
action: "scheduled" | "opened" | "cancelled"
```

Event action type

### symbol

```ts
symbol: string
```

Trading pair symbol

### signalId

```ts
signalId: string
```

Signal ID

### position

```ts
position: string
```

Position type

### note

```ts
note: string
```

Signal note

### currentPrice

```ts
currentPrice: number
```

Current market price

### priceOpen

```ts
priceOpen: number
```

Scheduled entry price

### takeProfit

```ts
takeProfit: number
```

Take profit price

### stopLoss

```ts
stopLoss: number
```

Stop loss price

### originalPriceTakeProfit

```ts
originalPriceTakeProfit: number
```

Original take profit price before modifications

### originalPriceStopLoss

```ts
originalPriceStopLoss: number
```

Original stop loss price before modifications

### totalExecuted

```ts
totalExecuted: number
```

Total executed percentage from partial closes

### closeTimestamp

```ts
closeTimestamp: number
```

Close timestamp (only for cancelled)

### duration

```ts
duration: number
```

Duration in minutes (only for cancelled/opened)

### cancelReason

```ts
cancelReason: "timeout" | "price_reject" | "user"
```

Cancellation reason (only for cancelled events)

### cancelId

```ts
cancelId: string
```

Cancellation ID (only for user-initiated cancellations)
