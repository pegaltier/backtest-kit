---
title: docs/type/TOptimizer
group: docs
---

# TOptimizer

```ts
type TOptimizer = {
    [key in keyof IOptimizer]: any;
};
```

Type definition for optimizer methods.
Maps all keys of IOptimizer to any type.
Used for dynamic method routing in OptimizerGlobalService.
