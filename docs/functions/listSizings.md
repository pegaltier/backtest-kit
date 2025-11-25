---
title: docs/api-reference/function/listSizings
group: docs
---

# listSizings

```ts
declare function listSizings(): Promise<ISizingSchema[]>;
```

Returns a list of all registered sizing schemas.

Retrieves all sizing configurations that have been registered via addSizing().
Useful for debugging, documentation, or building dynamic UIs.
