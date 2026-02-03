---
title: docs/type/ICommitRow
group: docs
---

# ICommitRow

```ts
type ICommitRow = IPartialProfitCommitRow | IPartialLossCommitRow | IBreakevenCommitRow | ITrailingStopCommitRow | ITrailingTakeCommitRow | IActivateScheduledCommitRow;
```

Discriminated union of all queued commit events.
These are stored in _commitQueue and processed in tick()/backtest().
