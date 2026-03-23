---
title: docs/interface/IStorageUtils
group: docs
---

# IStorageUtils

Base interface for storage adapters.
All storage adapters must implement this interface.

## Methods

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

Finds a signal by its ID.

### list

```ts
list: () => Promise<IStorageSignalRow[]>
```

Lists all stored signals.

### handleActivePing

```ts
handleActivePing: (event: ActivePingContract) => Promise<void>
```

Handles active ping event for opened signals.
Updates updatedAt for the signal if it is currently opened.

### handleSchedulePing

```ts
handleSchedulePing: (event: SchedulePingContract) => Promise<void>
```

Handles schedule ping event for scheduled signals.
Updates updatedAt for the signal if it is currently scheduled.
