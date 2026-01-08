---
title: docs/type/TExchange
group: docs
---

# TExchange

```ts
type TExchange = {
    [key in keyof IExchange]: any;
};
```

Type definition for exchange methods.
Maps all keys of IExchange to any type.
Used for dynamic method routing in ExchangeCoreService.
