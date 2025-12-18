---
title: docs/function/listOptimizers
group: docs
---

# listOptimizers

```ts
declare function listOptimizers(): Promise<IOptimizerSchema[]>;
```

Returns a list of all registered optimizer schemas.

Retrieves all optimizers that have been registered via addOptimizer().
Useful for debugging, documentation, or building dynamic UIs.
