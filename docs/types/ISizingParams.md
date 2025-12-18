---
title: docs/type/ISizingParams
group: docs
---

# ISizingParams

```ts
type ISizingParams = ISizingParamsFixedPercentage | ISizingParamsKelly | ISizingParamsATR;
```

Discriminated union for sizing parameters passed to ClientSizing constructor.
Extends ISizingSchema with logger instance for internal logging.
