---
title: docs/type/CacheFileFunction
group: docs
---

# CacheFileFunction

```ts
type CacheFileFunction = (symbol: string, ...args: any[]) => Promise<any>;
```

Async function type for file-cached functions.
First argument is always `symbol: string`, followed by optional spread args.
