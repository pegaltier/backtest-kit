---
title: docs/api-reference/class/OptimizerConnectionService
group: docs
---

# OptimizerConnectionService

Implements `TOptimizer`

Service for creating and caching optimizer client instances.
Handles dependency injection and template merging.

Features:
- Memoized optimizer instances (one per optimizerName)
- Template merging (custom + defaults)
- Logger injection
- Delegates to ClientOptimizer for actual operations

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### optimizerSchemaService

```ts
optimizerSchemaService: any
```

### optimizerTemplateService

```ts
optimizerTemplateService: any
```

### getOptimizer

```ts
getOptimizer: ((optimizerName: string) => ClientOptimizer) & IClearableMemoize<string> & IControlMemoize<string, ClientOptimizer>
```

Creates or retrieves cached optimizer instance.
Memoized by optimizerName for performance.

Merges custom templates from schema with defaults from OptimizerTemplateService.

### getData

```ts
getData: (symbol: string, optimizerName: string) => Promise<IOptimizerStrategy[]>
```

Fetches data from all sources and generates strategy metadata.

### getCode

```ts
getCode: (symbol: string, optimizerName: string) => Promise<string>
```

Generates complete executable strategy code.

### dump

```ts
dump: (symbol: string, optimizerName: string, path?: string) => Promise<void>
```

Generates and saves strategy code to file.
