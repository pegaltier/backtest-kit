---
title: docs/class/StorageLiveUtils
group: docs
---

# StorageLiveUtils

Utility class for managing live trading signal history.

Stores trading signal history for admin dashboard display during live trading
with automatic initialization, deduplication, and storage limits.

## Constructor

```ts
constructor();
```

## Properties

### _signals

```ts
_signals: any
```

### waitForInit

```ts
waitForInit: any
```

Initializes storage by loading existing signal history from persist layer.
Uses singleshot to ensure initialization happens only once.

### _updateStorage

```ts
_updateStorage: any
```

Persists current signal history to storage.
Sorts by priority and limits to MAX_SIGNALS entries.

### handleOpened

```ts
handleOpened: (tick: IStrategyTickResultOpened) => Promise<void>
```

Handles signal opened event.

### handleClosed

```ts
handleClosed: (tick: IStrategyTickResultClosed) => Promise<void>
```

Handles signal closed event.

### handleScheduled

```ts
handleScheduled: (tick: IStrategyTickResultScheduled) => Promise<void>
```

Handles signal scheduled event.

### handleCancelled

```ts
handleCancelled: (tick: IStrategyTickResultCancelled) => Promise<void>
```

Handles signal cancelled event.

### findById

```ts
findById: (id: string) => Promise<IStorageSignalRow>
```

Finds a signal by its unique identifier.

### list

```ts
list: () => Promise<IStorageSignalRow[]>
```

Lists all stored live signals.
