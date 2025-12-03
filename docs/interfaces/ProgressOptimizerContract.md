---
title: docs/api-reference/interface/ProgressOptimizerContract
group: docs
---

# ProgressOptimizerContract

Contract for optimizer progress events.

Emitted during optimizer execution to track progress.
Contains information about total sources, processed sources, and completion percentage.

## Properties

### optimizerName

```ts
optimizerName: string
```

optimizerName - Name of the optimizer being executed

### symbol

```ts
symbol: string
```

symbol - Trading symbol (e.g., "BTCUSDT")

### totalSources

```ts
totalSources: number
```

totalSources - Total number of sources to process

### processedSources

```ts
processedSources: number
```

processedSources - Number of sources processed so far

### progress

```ts
progress: number
```

progress - Completion percentage from 0.0 to 1.0
