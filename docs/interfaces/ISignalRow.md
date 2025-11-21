---
title: docs/api-reference/interface/ISignalRow
group: docs
---

# ISignalRow

Complete signal with auto-generated id.
Used throughout the system after validation.

## Properties

### id

```ts
id: string
```

Unique signal identifier (UUID v4 auto-generated)

### exchangeName

```ts
exchangeName: string
```

Unique exchange identifier for execution

### strategyName

```ts
strategyName: string
```

Unique strategy identifier for execution

### timestamp

```ts
timestamp: number
```

Signal creation timestamp in milliseconds

### symbol

```ts
symbol: string
```

Trading pair symbol (e.g., "BTCUSDT")
