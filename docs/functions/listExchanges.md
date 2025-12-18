---
title: docs/function/listExchanges
group: docs
---

# listExchanges

```ts
declare function listExchanges(): Promise<IExchangeSchema[]>;
```

Returns a list of all registered exchange schemas.

Retrieves all exchanges that have been registered via addExchange().
Useful for debugging, documentation, or building dynamic UIs.
