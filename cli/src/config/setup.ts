import {
  Storage,
  Notification,
  Markdown,
  Report,
  StorageLive,
  StorageBacktest,
  NotificationLive,
  NotificationBacktest,
} from "backtest-kit";

{
  Storage.enable();
  Notification.enable();
}

{
  Markdown.disable();
  Report.enable();
}

{
  StorageLive.usePersist();
  StorageBacktest.useDummy();
}

{
  NotificationLive.useDummy();
  NotificationBacktest.useDummy();
}
