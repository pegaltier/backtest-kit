---
title: docs/api-reference/class/OptimizerGlobalService
group: docs
---

# OptimizerGlobalService

Global service for optimizer operations with validation.
Entry point for public API, performs validation before delegating to ConnectionService.

Workflow:
1. Log operation
2. Validate optimizer exists
3. Delegate to OptimizerConnectionService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### optimizerConnectionService

```ts
optimizerConnectionService: any
```

### optimizerValidationService

```ts
optimizerValidationService: any
```

### getData

```ts
getData: (symbol: string, optimizerName: string) => Promise<IOptimizerStrategy[]>
```

Fetches data from all sources and generates strategy metadata.
Validates optimizer existence before execution.

### getCode

```ts
getCode: (symbol: string, optimizerName: string) => Promise<string>
```

Generates complete executable strategy code.
Validates optimizer existence before execution.

### dump

```ts
dump: (symbol: string, optimizerName: string, path?: string) => Promise<void>
```

Generates and saves strategy code to file.
Validates optimizer existence before execution.
