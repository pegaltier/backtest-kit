---
title: docs/class/PersistMeasureUtils
group: docs
---

# PersistMeasureUtils

Utility class for managing external API response cache persistence.

Features:
- Memoized storage instances per cache bucket (aligned timestamp + symbol)
- Custom adapter support
- Atomic read/write operations
- Crash-safe cache state management

Used by Cache.file for persistent caching of external API responses.

## Constructor

```ts
constructor();
```

## Properties

### PersistMeasureFactory

```ts
PersistMeasureFactory: any
```

### getMeasureStorage

```ts
getMeasureStorage: any
```

### readMeasureData

```ts
readMeasureData: (bucket: string, key: string) => Promise<unknown>
```

Reads cached measure data for a given bucket and key.

### writeMeasureData

```ts
writeMeasureData: (data: unknown, bucket: string, key: string) => Promise<void>
```

Writes measure data to disk with atomic file writes.

## Methods

### usePersistMeasureAdapter

```ts
usePersistMeasureAdapter(Ctor: TPersistBaseCtor<string, unknown>): void;
```

Registers a custom persistence adapter.

### useJson

```ts
useJson(): void;
```

Switches to the default JSON persist adapter.

### useDummy

```ts
useDummy(): void;
```

Switches to a dummy persist adapter that discards all writes.
