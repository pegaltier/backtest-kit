---
title: docs/api-reference/interface/IStrategyTickResultOpened
group: docs
---

# IStrategyTickResultOpened

Tick result: new signal just created.
Triggered after getSignal validation and persistence.

## Properties

### action

```ts
action: "opened"
```

Discriminator for type-safe union

### signal

```ts
signal: ISignalRow
```

Newly created and validated signal with generated ID
