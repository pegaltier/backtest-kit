---
title: docs/class/OptimizerSchemaService
group: docs
---

# OptimizerSchemaService

Service for managing optimizer schema registration and retrieval.
Provides validation and registry management for optimizer configurations.

Uses ToolRegistry for immutable schema storage.

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: LoggerService
```

### _registry

```ts
_registry: any
```

### register

```ts
register: (key: string, value: IOptimizerSchema) => void
```

Registers a new optimizer schema.
Validates required fields before registration.

### validateShallow

```ts
validateShallow: any
```

Validates optimizer schema structure.
Checks required fields: optimizerName, rangeTrain, source, getPrompt.

### override

```ts
override: (key: string, value: Partial<IOptimizerSchema>) => IOptimizerSchema
```

Partially overrides an existing optimizer schema.
Merges provided values with existing schema.

### get

```ts
get: (key: string) => IOptimizerSchema
```

Retrieves optimizer schema by name.
