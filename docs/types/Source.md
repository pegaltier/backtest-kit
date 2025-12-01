---
title: docs/api-reference/type/Source
group: docs
---

# Source

```ts
type Source<Data extends IOptimizerData = any> = IOptimizerSourceFn<Data> | IOptimizerSource<Data>;
```

Union type for data source configuration.
Can be either a simple fetch function or a full source configuration object.
