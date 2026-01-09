---
title: docs/type/IWalkerLogicPrivateService
group: docs
---

# IWalkerLogicPrivateService

```ts
type IWalkerLogicPrivateService = Omit<WalkerLogicPrivateService, keyof {
    loggerService: never;
    walkerSchemaService: never;
    backtestMarkdownService: never;
    backtestLogicPublicService: never;
}>;
```

Type definition for public WalkerLogic service.
Omits private dependencies from WalkerLogicPrivateService.
