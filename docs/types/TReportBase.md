---
title: docs/type/TReportBase
group: docs
---

# TReportBase

```ts
type TReportBase = {
    waitForInit(initial: boolean): Promise<void>;
    write<T = any>(data: T, options: IReportDumpOptions): Promise<void>;
};
```

Base interface for report storage adapters.
All report adapters must implement this interface.
