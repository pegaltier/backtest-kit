---
title: docs/class/SizingConnectionService
group: docs
---

# SizingConnectionService

Implements `TSizing$1`

Connection service routing sizing operations to correct ClientSizing instance.

Routes sizing method calls to the appropriate sizing implementation
based on the provided sizingName parameter. Uses memoization to cache
ClientSizing instances for performance.

Key features:
- Explicit sizing routing via sizingName parameter
- Memoized ClientSizing instances by sizingName
- Position size calculation with risk management

Note: sizingName is empty string for strategies without sizing configuration.

## Constructor

```ts
constructor();
```

## Properties

### loggerService

```ts
loggerService: any
```

### sizingSchemaService

```ts
sizingSchemaService: any
```

### getSizing

```ts
getSizing: ((sizingName: string) => ClientSizing) & IClearableMemoize<string> & IControlMemoize<string, ClientSizing>
```

Retrieves memoized ClientSizing instance for given sizing name.

Creates ClientSizing on first call, returns cached instance on subsequent calls.
Cache key is sizingName string.

### calculate

```ts
calculate: (params: ISizingCalculateParams, context: { sizingName: string; }) => Promise<number>
```

Calculates position size based on risk parameters and configured method.

Routes to appropriate ClientSizing instance based on provided context.
Supports multiple sizing methods: fixed-percentage, kelly-criterion, atr-based.
