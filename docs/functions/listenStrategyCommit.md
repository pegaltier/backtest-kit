---
title: docs/function/listenStrategyCommit
group: docs
---

# listenStrategyCommit

```ts
declare function listenStrategyCommit(fn: (event: StrategyCommitContract) => void): () => void;
```

Subscribes to strategy management events with queued async processing.

Emits when strategy management actions are executed:
- cancel-scheduled: Scheduled signal cancelled
- close-pending: Pending signal closed
- partial-profit: Partial close at profit level
- partial-loss: Partial close at loss level
- trailing-stop: Stop-loss adjusted
- trailing-take: Take-profit adjusted
- breakeven: Stop-loss moved to entry price

Events are processed sequentially in order received, even if callback is async.
Uses queued wrapper to prevent concurrent execution of the callback.

## Parameters

| Parameter | Description |
|-----------|-------------|
| `fn` | Callback function to handle strategy commit events |
