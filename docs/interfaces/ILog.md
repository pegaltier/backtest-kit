---
title: docs/interface/ILog
group: docs
---

# ILog

Extended logger interface with log history access.

## Methods

### getList

```ts
getList: () => Promise<ILogEntry[]>
```

Returns all stored log entries.
