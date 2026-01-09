---
title: docs/type/TRisk
group: docs
---

# TRisk

```ts
type TRisk = {
    [key in keyof IRisk]: any;
};
```

Type definition for risk methods.
Maps all keys of IRisk to any type.
Used for dynamic method routing in RiskGlobalService.
