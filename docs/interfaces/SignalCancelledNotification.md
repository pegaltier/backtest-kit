---
title: docs/interface/SignalCancelledNotification
group: docs
---

# SignalCancelledNotification

Signal cancelled notification.
Emitted when a scheduled signal is cancelled before activation.

## Properties

### type

```ts
type: "signal.cancelled"
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

### cancelReason

```ts
cancelReason: string
```

### cancelId

```ts
cancelId: string
```

### duration

```ts
duration: number
```
