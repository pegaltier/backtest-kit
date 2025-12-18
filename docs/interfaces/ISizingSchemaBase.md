---
title: docs/interface/ISizingSchemaBase
group: docs
---

# ISizingSchemaBase

Base sizing schema with common fields.

## Properties

### sizingName

```ts
sizingName: string
```

Unique identifier for this sizing configuration

### note

```ts
note: string
```

Optional developer note for documentation

### maxPositionPercentage

```ts
maxPositionPercentage: number
```

Maximum position size as % of account (0-100)

### minPositionSize

```ts
minPositionSize: number
```

Minimum position size (absolute value)

### maxPositionSize

```ts
maxPositionSize: number
```

Maximum position size (absolute value)

### callbacks

```ts
callbacks: Partial<ISizingCallbacks>
```

Optional lifecycle callbacks
