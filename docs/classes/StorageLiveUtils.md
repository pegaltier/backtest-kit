---
title: docs/class/StorageLiveUtils
group: docs
---

# StorageLiveUtils

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

### _updateStorage

```ts
_updateStorage: any
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
