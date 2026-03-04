---
title: docs/interface/IBroker
group: docs
---

# IBroker

## Methods

### waitForInit

```ts
waitForInit: () => Promise<void>
```

### onSignalCloseCommit

```ts
onSignalCloseCommit: (payload: BrokerSignalClosePayload) => Promise<void>
```

### onSignalOpenCommit

```ts
onSignalOpenCommit: (payload: BrokerSignalOpenPayload) => Promise<void>
```

### onPartialProfitCommit

```ts
onPartialProfitCommit: (payload: BrokerPartialProfitPayload) => Promise<void>
```

### onPartialLossCommit

```ts
onPartialLossCommit: (payload: BrokerPartialLossPayload) => Promise<void>
```

### onTrailingStopCommit

```ts
onTrailingStopCommit: (payload: BrokerTrailingStopPayload) => Promise<void>
```

### onTrailingTakeCommit

```ts
onTrailingTakeCommit: (payload: BrokerTrailingTakePayload) => Promise<void>
```

### onBreakevenCommit

```ts
onBreakevenCommit: (payload: BrokerBreakevenPayload) => Promise<void>
```

### onAverageBuyCommit

```ts
onAverageBuyCommit: (payload: BrokerAverageBuyPayload) => Promise<void>
```
