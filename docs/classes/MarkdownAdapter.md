---
title: docs/class/MarkdownAdapter
group: docs
---

# MarkdownAdapter

Extends `MarkdownUtils`

Markdown adapter with pluggable storage backend and instance memoization.

Features:
- Adapter pattern for swappable storage implementations
- Memoized storage instances (one per markdown type)
- Default adapter: MarkdownFolderBase (separate files)
- Alternative adapter: MarkdownFileBase (JSONL append)
- Lazy initialization on first write
- Convenience methods: useMd(), useJsonl()

## Constructor

```ts
constructor();
```

## Properties

### MarkdownFactory

```ts
MarkdownFactory: any
```

Current markdown storage adapter constructor.
Defaults to MarkdownFolderBase for separate file storage.
Can be changed via useMarkdownAdapter().

### getMarkdownStorage

```ts
getMarkdownStorage: any
```

Memoized storage instances cache.
Key: markdownName (backtest, live, walker, etc.)
Value: TMarkdownBase instance created with current MarkdownFactory.
Ensures single instance per markdown type for the lifetime of the application.

## Methods

### useMarkdownAdapter

```ts
useMarkdownAdapter(Ctor: TMarkdownBaseCtor): void;
```

Sets the markdown storage adapter constructor.
All future markdown instances will use this adapter.

### writeData

```ts
writeData(markdownName: MarkdownName, content: string, options: IMarkdownDumpOptions): Promise<void>;
```

Writes markdown data to storage using the configured adapter.
Automatically initializes storage on first write for each markdown type.

### useMd

```ts
useMd(): void;
```

Switches to folder-based markdown storage (default).
Shorthand for useMarkdownAdapter(MarkdownFolderBase).
Each dump creates a separate .md file.

### useJsonl

```ts
useJsonl(): void;
```

Switches to JSONL-based markdown storage.
Shorthand for useMarkdownAdapter(MarkdownFileBase).
All dumps append to a single .jsonl file per markdown type.

### useDummy

```ts
useDummy(): void;
```

Switches to a dummy markdown adapter that discards all writes.
All future markdown writes will be no-ops.
