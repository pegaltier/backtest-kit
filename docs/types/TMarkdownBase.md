---
title: docs/type/TMarkdownBase
group: docs
---

# TMarkdownBase

```ts
type TMarkdownBase = {
    waitForInit(initial: boolean): Promise<void>;
    dump(content: string, options: IMarkdownDumpOptions): Promise<void>;
};
```

Base interface for markdown storage adapters.
All markdown adapters must implement this interface.
