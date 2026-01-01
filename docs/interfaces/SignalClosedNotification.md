---
title: docs/interface/SignalClosedNotification
group: docs
---

# SignalClosedNotification

Signal closed notification.
Emitted when a trading position is closed (TP/SL hit).

## Properties

### type

```ts
type: "signal.closed"
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

### priceClose

```ts
priceClose: number
```

### pnlPercentage

```ts
pnlPercentage: number
```

### closeReason

```ts
closeReason: string
```

### duration

```ts
duration: number
```

### note

```ts
note: string
```
