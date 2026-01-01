---
title: docs/interface/SignalOpenedNotification
group: docs
---

# SignalOpenedNotification

Signal opened notification.
Emitted when a new trading position is opened.

## Properties

### type

```ts
type: "signal.opened"
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

### priceTakeProfit

```ts
priceTakeProfit: number
```

### priceStopLoss

```ts
priceStopLoss: number
```

### note

```ts
note: string
```
