---
title: docs/type/TMemoryInstance
group: docs
---

# TMemoryInstance

```ts
type TMemoryInstance = Omit<{
    [key in keyof IMemoryInstance]: any;
}, keyof {
    waitForInit: never;
}>;
```

Public surface of MemoryAdapter - IMemoryInstance minus waitForInit.
waitForInit is managed internally by the adapter.
