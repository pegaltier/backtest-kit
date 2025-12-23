---
title: docs/class/CacheUtils
group: docs
---

# CacheUtils

Utility class for function caching with timeframe-based invalidation.

Provides simplified API for wrapping functions with automatic caching.
Exported as singleton instance for convenient usage.

## Constructor

```ts
constructor();
```

## Properties

### _getInstance

```ts
_getInstance: any
```

Memoized function to get or create CacheInstance for a function.
Each function gets its own isolated cache instance.

### fn

```ts
fn: <T extends Function>(run: T, context: { interval: CandleInterval; }) => Function
```

Wrap a function with caching based on timeframe intervals.

Returns a wrapped version of the function that automatically caches results
and invalidates based on the specified candle interval.

### clear

```ts
clear: <T extends Function>(run?: T) => void
```

Clear cached instances for specific function or all cached functions.

This method delegates to the memoized `_getInstance` function's clear method,
which removes cached CacheInstance objects. When a CacheInstance is removed,
all cached function results for that instance are also discarded.

Use cases:
- Clear cache for a specific function when its implementation changes
- Free memory by removing unused cached instances
- Reset all caches when switching contexts (e.g., between different backtests)
