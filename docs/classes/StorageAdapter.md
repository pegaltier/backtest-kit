---
title: docs/class/StorageAdapter
group: docs
---

# StorageAdapter

Main storage adapter for signal history management.

Provides unified interface for accessing backtest and live signal history
for admin dashboard. Subscribes to signal emitters and automatically
updates history on signal events.

## Constructor

```ts
constructor();
```

## Properties

### _signalLiveUtils

```ts
_signalLiveUtils: StorageLiveUtils
```

### _signalBacktestUtils

```ts
_signalBacktestUtils: StorageBacktestUtils
```

### enable

```ts
enable: (() => () => void) & ISingleshotClearable
```

Enables signal history tracking by subscribing to emitters.

### disable

```ts
disable: () => void
```

Disables signal history tracking by unsubscribing from emitters.

### findSignalById

```ts
findSignalById: (id: string) => Promise<IStorageSignalRow>
```

Finds a signal by ID across both backtest and live history.

### listSignalBacktest

```ts
listSignalBacktest: () => Promise<IStorageSignalRow[]>
```

Lists all backtest signal history.

### listSignalLive

```ts
listSignalLive: () => Promise<IStorageSignalRow[]>
```

Lists all live signal history.
