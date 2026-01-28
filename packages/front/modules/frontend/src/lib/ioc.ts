import "./config/provide";

import { getErrorMessage, inject } from "react-declarative";

import ErrorService from "./services/base/ErrorService";
import LayoutService from "./services/base/LayoutService";
import LoggerService from "./services/base/LoggerService";
import RouterService from "./services/base/RouterService";

import TYPES from "./config/TYPES";
import AlertService from "./services/base/AlertService";
import ReportViewService from "./services/view/ReportViewService";
import JwtService from "./services/base/JwtService";
import RevenueViewService from "./services/view/RevenueViewService";
import ActionViewService from "./services/view/ActionViewService";
import MeasureViewService from "./services/view/MeasureViewService";
import OrderViewService from "./services/view/OrderViewService";
import CandleViewService from "./services/view/CandleViewService";
import ColorHelperService from "./services/helper/ColorHelperService";
import OrderCloseViewService from "./services/view/OrderCloseViewService";
import SettingViewService from "./services/view/SettingViewService";
import NotifyViewService from "./services/view/NotifyViewService";
import OrderHideViewService from "./services/view/OrderHideViewService";

const baseServices = {
  errorService: inject<ErrorService>(TYPES.errorService),
  layoutService: inject<LayoutService>(TYPES.layoutService),
  loggerService: inject<LoggerService>(TYPES.loggerService),
  routerService: inject<RouterService>(TYPES.routerService),
  alertService: inject<AlertService>(TYPES.alertService),
  jwtService: inject<JwtService>(TYPES.jwtService),
};

const helperServices = {
  colorHelperService: inject<ColorHelperService>(TYPES.colorHelperService),
}

const viewServices = {
  actionViewService: inject<ActionViewService>(TYPES.actionViewService),
  revenueViewService: inject<RevenueViewService>(TYPES.revenueViewService),
  reportViewService: inject<ReportViewService>(TYPES.reportViewService),
  measureViewService: inject<MeasureViewService>(TYPES.measureViewService),
  orderViewService: inject<OrderViewService>(TYPES.orderViewService),
  orderCloseViewService: inject<OrderCloseViewService>(TYPES.orderCloseViewService),
  candleViewService: inject<CandleViewService>(TYPES.candleViewService),
  settingViewService: inject<SettingViewService>(TYPES.settingViewService),
  notifyViewService: inject<NotifyViewService>(TYPES.notifyViewService),
  orderHideViewService: inject<OrderHideViewService>(TYPES.orderHideViewService),
};

const ioc = {
  ...baseServices,
  ...helperServices,
  ...viewServices,
};

ioc.routerService.listen(({ action, location }) => {
  if (location.pathname === "/error_page") {
    return;
  }
  if (location.pathname === "/offline_page") {
    return;
  }
  if (action === "PUSH") {
    console.clear();
  }
});

window.addEventListener("unhandledrejection", (error) => {
  ioc.errorService.handleGlobalError(new Error(error.reason));
});

window.addEventListener("error", (error) => {
    ioc.errorService.handleGlobalError(new Error(getErrorMessage(error)));
});

export type Ioc = typeof ioc;

(window as any).ioc = ioc;

export default ioc;
