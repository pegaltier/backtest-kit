---
title: docs/api-reference/interface/IOptimizer
group: docs
---

# IOptimizer

Optimizer client interface for strategy generation and code export.
Implemented by ClientOptimizer class.

## Methods

### getData

```ts
getData: (symbol: string) => Promise<IOptimizerStrategy[]>
```

Fetches data from all sources and generates strategy metadata.
Processes each training range and builds LLM conversation history.

### getCode

```ts
getCode: (symbol: string) => Promise<string>
```

Generates complete executable strategy code.
Includes imports, helpers, strategies, walker, and launcher.

### dump

```ts
dump: (symbol: string, path?: string) => Promise<void>
```

Generates and saves strategy code to file.
Creates directory if needed, writes .mjs file.
