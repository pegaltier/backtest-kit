---
title: docs/api-reference/class/PersistSignalUtils
group: docs
---

# PersistSignalUtils

## Constructor

```ts
constructor();
```

## Properties

### PersistSignalFactory

```ts
PersistSignalFactory: any
```

### getSignalStorage

```ts
getSignalStorage: any
```

### readSignalData

```ts
readSignalData: (strategyName: string, symbol: string) => Promise<ISignalRow>
```

### writeSignalData

```ts
writeSignalData: (signalRow: ISignalRow, strategyName: string, symbol: string) => Promise<void>
```

## Methods

### usePersistSignalAdapter

```ts
usePersistSignalAdapter(Ctor: TPersistBaseCtor<StrategyName, ISignalData>): void;
```
