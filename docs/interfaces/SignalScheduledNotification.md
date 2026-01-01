---
title: docs/interface/SignalScheduledNotification
group: docs
---

# SignalScheduledNotification

Scheduled signal notification.
Emitted when a signal is scheduled for future execution.

## Properties

### type

```ts
type: "signal.scheduled"
```

### id

```ts
id: string
```

### timestamp

```ts
timestamp: number
```

### backtest

```ts
backtest: boolean
```

### symbol

```ts
symbol: string
```

### strategyName

```ts
strategyName: string
```

### exchangeName

```ts
exchangeName: string
```

### signalId

```ts
signalId: string
```

### position

```ts
position: "long" | "short"
```

### priceOpen

```ts
priceOpen: number
```

### scheduledAt

```ts
scheduledAt: number
```

### currentPrice

```ts
currentPrice: number
```
