---
title: docs/type/NotificationModel
group: docs
---

# NotificationModel

```ts
type NotificationModel = SignalOpenedNotification | SignalClosedNotification | PartialProfitAvailableNotification | PartialLossAvailableNotification | BreakevenAvailableNotification | PartialProfitCommitNotification | PartialLossCommitNotification | BreakevenCommitNotification | AverageBuyCommitNotification | ActivateScheduledCommitNotification | TrailingStopCommitNotification | TrailingTakeCommitNotification | SignalSyncOpenNotification | SignalSyncCloseNotification | RiskRejectionNotification | SignalScheduledNotification | SignalCancelledNotification | InfoErrorNotification | CriticalErrorNotification | ValidationErrorNotification;
```

Root discriminated union of all notification types.
Type discrimination is done via the `type` field.
