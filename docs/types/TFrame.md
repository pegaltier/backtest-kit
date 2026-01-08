---
title: docs/type/TFrame
group: docs
---

# TFrame

```ts
type TFrame = {
    [key in keyof IFrame]: any;
};
```

Type definition for frame methods.
Maps all keys of IFrame to any type.
Used for dynamic method routing in FrameCoreService.
