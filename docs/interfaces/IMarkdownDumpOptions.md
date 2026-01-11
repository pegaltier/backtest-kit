---
title: docs/interface/IMarkdownDumpOptions
group: docs
---

# IMarkdownDumpOptions

Options for markdown dump operations.
Contains path information and metadata for filtering.

## Properties

### path

```ts
path: string
```

Directory path relative to process.cwd()

### file

```ts
file: string
```

File name including extension

### symbol

```ts
symbol: string
```

Trading pair symbol (e.g., "BTCUSDT")

### strategyName

```ts
strategyName: string
```

Strategy name

### exchangeName

```ts
exchangeName: string
```

Exchange name

### frameName

```ts
frameName: string
```

Frame name (timeframe identifier)

### signalId

```ts
signalId: string
```

Signal unique identifier
