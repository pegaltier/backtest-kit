---
title: docs/class/OptimizerValidationService
group: docs
---

# OptimizerValidationService

Service for validating optimizer existence and managing optimizer registry.
Maintains a Map of registered optimizers for validation purposes.

Uses memoization for efficient repeated validation checks.

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### _optimizerMap

```ts
_optimizerMap: any
```

### addOptimizer

```ts
addOptimizer: (optimizerName: string, optimizerSchema: IOptimizerSchema) => void
```

Adds optimizer to validation registry.
Prevents duplicate optimizer names.

### validate

```ts
validate: (optimizerName: string, source: string) => void
```

Validates that optimizer exists in registry.
Memoized for performance on repeated checks.

### list

```ts
list: () => Promise<IOptimizerSchema[]>
```

Lists all registered optimizer schemas.
