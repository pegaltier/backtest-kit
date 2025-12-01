---
title: docs/api-reference/class/OptimizerUtils
group: docs
---

# OptimizerUtils

Public API utilities for optimizer operations.
Provides high-level methods for strategy generation and code export.

Usage:
```typescript
import { Optimizer } from "backtest-kit";

// Get strategy data
const strategies = await Optimizer.getData("BTCUSDT", {
  optimizerName: "my-optimizer"
});

// Generate code
const code = await Optimizer.getCode("BTCUSDT", {
  optimizerName: "my-optimizer"
});

// Save to file
await Optimizer.dump("BTCUSDT", {
  optimizerName: "my-optimizer"
}, "./output");
```

## Constructor

```ts
constructor();
```

## Properties

### getData

```ts
getData: (symbol: string, context: { optimizerName: string; }) => Promise<IOptimizerStrategy[]>
```

Fetches data from all sources and generates strategy metadata.
Processes each training range and builds LLM conversation history.

### getCode

```ts
getCode: (symbol: string, context: { optimizerName: string; }) => Promise<string>
```

Generates complete executable strategy code.
Includes imports, helpers, strategies, walker, and launcher.

### dump

```ts
dump: (symbol: string, context: { optimizerName: string; }, path?: string) => Promise<void>
```

Generates and saves strategy code to file.
Creates directory if needed, writes .mjs file.

Format: `{optimizerName}_{symbol}.mjs`
