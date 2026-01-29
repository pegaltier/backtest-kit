import { Notification } from "backtest-kit";
import { singleshot } from "functools-kit";

import LoggerService from "../base/LoggerService";
import { TYPES } from "../../../lib/core/types";
import { inject } from "../../../lib/core/di";

export class NotificationViewService {
  private readonly loggerService = inject<LoggerService>(TYPES.loggerService);

  public getList = async () => {
    this.loggerService.log("notificationViewService getList");
    return await Notification.getData();
  };

  public getOne = async (id: string) => {
    this.loggerService.log("notificationViewService getOne");
    const notificationList = await Notification.getData();
    return notificationList.find((item) => item.id === id) ?? null;
  };

  protected init = singleshot(async () => {
    this.loggerService.log("notificationViewService init");
    Notification.enable();
  });
}

export default NotificationViewService;
