---
title: docs/type/TSizing
group: docs
---

# TSizing

```ts
type TSizing = {
    [key in keyof ISizing]: any;
};
```

Type definition for sizing methods.
Maps all keys of ISizing to any type.
Used for dynamic method routing in SizingGlobalService.
