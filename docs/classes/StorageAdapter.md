---
title: docs/class/StorageAdapter
group: docs
---

# StorageAdapter

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

### disable

```ts
disable: () => void
```

### findSignalById

```ts
findSignalById: (id: string) => Promise<IStorageSignalRow>
```

### listSignalBacktest

```ts
listSignalBacktest: () => Promise<IStorageSignalRow[]>
```

### listSignalLive

```ts
listSignalLive: () => Promise<IStorageSignalRow[]>
```
