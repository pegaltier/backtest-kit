---
title: docs/type/NotificationModel
group: docs
---

# NotificationModel

```ts
type NotificationModel = SignalOpenedNotification | SignalClosedNotification | PartialProfitNotification | PartialLossNotification | RiskRejectionNotification | SignalScheduledNotification | SignalCancelledNotification | BacktestDoneNotification | LiveDoneNotification | InfoErrorNotification | CriticalErrorNotification | ValidationErrorNotification | ProgressBacktestNotification | BootstrapNotification;
```

Root discriminated union of all notification types.
Type discrimination is done via the `type` field.
