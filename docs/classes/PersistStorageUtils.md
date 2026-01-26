---
title: docs/class/PersistStorageUtils
group: docs
---

# PersistStorageUtils

Utility class for managing signal storage persistence.

Features:
- Memoized storage instances
- Custom adapter support
- Atomic read/write operations for StorageData
- Each signal stored as separate file keyed by id
- Crash-safe signal state management

Used by SignalLiveUtils for live mode persistence of signals.

## Constructor

```ts
constructor();
```

## Properties

### PersistStorageFactory

```ts
PersistStorageFactory: any
```

### getStorageStorage

```ts
getStorageStorage: any
```

### readStorageData

```ts
readStorageData: (backtest: boolean) => Promise<StorageData>
```

Reads persisted signals data.

Called by StorageLiveUtils/StorageBacktestUtils.waitForInit() to restore state.
Uses keys() from PersistBase to iterate over all stored signals.
Returns empty array if no signals exist.

### writeStorageData

```ts
writeStorageData: (signalData: StorageData, backtest: boolean) => Promise<void>
```

Writes signal data to disk with atomic file writes.

Called by StorageLiveUtils/StorageBacktestUtils after signal changes to persist state.
Uses signal.id as the storage key for individual file storage.
Uses atomic writes to prevent corruption on crashes.

## Methods

### usePersistStorageAdapter

```ts
usePersistStorageAdapter(Ctor: TPersistBaseCtor<string, IStorageSignalRow>): void;
```

Registers a custom persistence adapter.

### useJson

```ts
useJson(): void;
```

Switches to the default JSON persist adapter.
All future persistence writes will use JSON storage.

### useDummy

```ts
useDummy(): void;
```

Switches to a dummy persist adapter that discards all writes.
All future persistence writes will be no-ops.
