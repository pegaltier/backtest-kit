---
title: docs/api-reference/class/SizingValidationService
group: docs
---

# SizingValidationService

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### _sizingMap

```ts
_sizingMap: any
```

### addSizing

```ts
addSizing: (sizingName: string, sizingSchema: ISizingSchema) => void
```

Adds a sizing schema to the validation service

### validate

```ts
validate: (sizingName: string, source: string, method?: "fixed-percentage" | "kelly-criterion" | "atr-based") => void
```

Validates the existence of a sizing and optionally its method

### list

```ts
list: () => Promise<ISizingSchema[]>
```

Returns a list of all registered sizing schemas
