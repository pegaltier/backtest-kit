---
title: docs/api-reference/type/ReduceCallback
group: docs
---

# ReduceCallback

```ts
type ReduceCallback<T> = (accumulator: T, currentResult: IStrategyTickResult, index: number, symbol: string, when: Date) => T | Promise<T>;
```


