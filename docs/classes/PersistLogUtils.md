---
title: docs/class/PersistLogUtils
group: docs
---

# PersistLogUtils

Utility class for managing log entry persistence.

Features:
- Memoized storage instance
- Custom adapter support
- Atomic read/write operations for LogData
- Each log entry stored as separate file keyed by id
- Crash-safe log state management

Used by LogPersistUtils for log entry persistence.

## Constructor

```ts
constructor();
```

## Properties

### PersistLogFactory

```ts
PersistLogFactory: any
```

### _logStorage

```ts
_logStorage: any
```

### getLogStorage

```ts
getLogStorage: any
```

### readLogData

```ts
readLogData: () => Promise<LogData>
```

Reads persisted log entries.

Called by LogPersistUtils.waitForInit() to restore state.
Uses keys() from PersistBase to iterate over all stored entries.
Returns empty array if no entries exist.

### writeLogData

```ts
writeLogData: (logData: LogData) => Promise<void>
```

Writes log entries to disk with atomic file writes.

Called by LogPersistUtils after each log call to persist state.
Uses entry.id as the storage key for individual file storage.
Uses atomic writes to prevent corruption on crashes.

## Methods

### usePersistLogAdapter

```ts
usePersistLogAdapter(Ctor: TPersistBaseCtor<string, ILogEntry>): void;
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
