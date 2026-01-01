---
title: docs/interface/PartialLossNotification
group: docs
---

# PartialLossNotification

Partial loss notification.
Emitted when signal reaches loss level milestone (-10%, -20%, etc).

## Properties

### type

```ts
type: "partial.loss"
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

### level

```ts
level: PartialLevel
```

### currentPrice

```ts
currentPrice: number
```

### priceOpen

```ts
priceOpen: number
```

### position

```ts
position: "long" | "short"
```
