const baseServices = {
  alertService: Symbol("alertService"),
  errorService: Symbol("errorService"),
  layoutService: Symbol("layoutService"),
  loggerService: Symbol("loggerService"),
  routerService: Symbol("routerService"),
  jwtService: Symbol("jwtService"),
};

const helperServices = {
  colorHelperService: Symbol('colorHelperService'),
};

const viewServices = {
  actionViewService: Symbol('actionViewService'),
  revenueViewService: Symbol("revenueViewService"),
  reportViewService: Symbol("reportViewService"),
  measureViewService: Symbol("measureViewService"),
  orderViewService: Symbol("orderViewService"),
  orderCloseViewService: Symbol("orderCloseViewService"),
  candleViewService: Symbol("candleViewService"),
  settingViewService: Symbol("settingViewService"),
  notifyViewService: Symbol("notifyViewService"),
  orderHideViewService: Symbol("orderHideViewService"),
};

export const TYPES = {
  ...baseServices,
  ...viewServices,
  ...helperServices,
};

export default TYPES;
