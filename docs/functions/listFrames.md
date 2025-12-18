---
title: docs/function/listFrames
group: docs
---

# listFrames

```ts
declare function listFrames(): Promise<IFrameSchema[]>;
```

Returns a list of all registered frame schemas.

Retrieves all frames that have been registered via addFrame().
Useful for debugging, documentation, or building dynamic UIs.
