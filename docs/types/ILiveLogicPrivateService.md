---
title: docs/type/ILiveLogicPrivateService
group: docs
---

# ILiveLogicPrivateService

```ts
type ILiveLogicPrivateService = Omit<LiveLogicPrivateService, keyof {
    loggerService: never;
    strategyCoreService: never;
    methodContextService: never;
}>;
```

Type definition for public LiveLogic service.
Omits private dependencies from LiveLogicPrivateService.
