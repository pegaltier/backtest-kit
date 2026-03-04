---
title: docs/interface/CancelScheduledCommit
group: docs
---

# CancelScheduledCommit

Cancel scheduled signal event.

## Properties

### action

```ts
action: "cancel-scheduled"
```

Discriminator for cancel-scheduled action

### cancelId

```ts
cancelId: string
```

Optional identifier for the cancellation reason (user-provided)

### pnl

```ts
pnl: IStrategyPnL
```

Unrealized PNL at the moment of cancellation
