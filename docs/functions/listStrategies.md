---
title: docs/function/listStrategies
group: docs
---

# listStrategies

```ts
declare function listStrategies(): Promise<IStrategySchema[]>;
```

Returns a list of all registered strategy schemas.

Retrieves all strategies that have been registered via addStrategy().
Useful for debugging, documentation, or building dynamic UIs.
