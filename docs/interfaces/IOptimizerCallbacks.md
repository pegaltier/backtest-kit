---
title: docs/api-reference/interface/IOptimizerCallbacks
group: docs
---

# IOptimizerCallbacks

Lifecycle callbacks for optimizer events.
Provides hooks for monitoring and validating optimizer operations.

## Properties

### onData

```ts
onData: (symbol: string, strategyData: IOptimizerStrategy[]) => void | Promise<void>
```

Called after strategy data is generated for all train ranges.
Useful for logging or validating the generated strategies.

### onCode

```ts
onCode: (symbol: string, code: string) => void | Promise<void>
```

Called after strategy code is generated.
Useful for logging or validating the generated code.

### onDump

```ts
onDump: (symbol: string, filepath: string) => void | Promise<void>
```

Called after strategy code is dumped to file.
Useful for logging or performing additional actions after file write.

### onSourceData

```ts
onSourceData: <Data extends IOptimizerData = any>(symbol: string, sourceName: string, data: Data[], startDate: Date, endDate: Date) => void | Promise<void>
```

Called after data is fetched from a source.
Useful for logging or validating the fetched data.
