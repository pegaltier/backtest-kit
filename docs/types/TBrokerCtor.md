---
title: docs/type/TBrokerCtor
group: docs
---

# TBrokerCtor

```ts
type TBrokerCtor = new () => Partial<IBroker>;
```

Constructor type for a broker adapter class.

Used by `BrokerAdapter.useBrokerAdapter` to accept a class (not an instance).
All `IBroker` methods are optional — implement only what the adapter needs.
