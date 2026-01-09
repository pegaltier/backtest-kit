---
title: docs/type/TPartial
group: docs
---

# TPartial

```ts
type TPartial = {
    [key in keyof IPartial]: any;
};
```

Type definition for partial methods.
Maps all keys of IPartial to any type.
Used for dynamic method routing in PartialGlobalService.
