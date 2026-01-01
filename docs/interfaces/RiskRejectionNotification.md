---
title: docs/interface/RiskRejectionNotification
group: docs
---

# RiskRejectionNotification

Risk rejection notification.
Emitted when a signal is rejected due to risk management rules.

## Properties

### type

```ts
type: "risk.rejection"
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

### rejectionNote

```ts
rejectionNote: string
```

### rejectionId

```ts
rejectionId: string
```

### activePositionCount

```ts
activePositionCount: number
```

### currentPrice

```ts
currentPrice: number
```

### pendingSignal

```ts
pendingSignal: ISignalDto
```
