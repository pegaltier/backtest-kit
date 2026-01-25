---
title: docs/class/StorageBacktestUtils
group: docs
---

# StorageBacktestUtils

## Constructor

```ts
constructor();
```

## Properties

### _signals

```ts
_signals: any
```

### handleOpened

```ts
handleOpened: (tick: IStrategyTickResultOpened) => Promise<void>
```

### handleClosed

```ts
handleClosed: (tick: IStrategyTickResultClosed) => Promise<void>
```

### handleScheduled

```ts
handleScheduled: (tick: IStrategyTickResultScheduled) => Promise<void>
```

### handleCancelled

```ts
handleCancelled: (tick: IStrategyTickResultCancelled) => Promise<void>
```

### findById

```ts
findById: (id: string) => Promise<IStorageSignalRow>
```

### list

```ts
list: () => Promise<IStorageSignalRow[]>
```
