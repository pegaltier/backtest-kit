---
title: docs/type/TRisk$1
group: docs
---

# TRisk$1

```ts
type TRisk$1 = {
    [key in keyof IRisk]: any;
};
```

Type definition for risk methods.
Maps all keys of IRisk to any type.
Used for dynamic method routing in RiskConnectionService.
