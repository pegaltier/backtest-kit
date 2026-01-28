import { provide } from "react-declarative";
import TYPES from "./TYPES";

import ErrorService from "../services/base/ErrorService";
import LayoutService from "../services/base/LayoutService";
import LoggerService from "../services/base/LoggerService";
import RouterService from "../services/base/RouterService";
import AlertService from "../services/base/AlertService";
import ReportViewService from "../services/view/ReportViewService";
import JwtService from "../services/base/JwtService";
import RevenueViewService from "../services/view/RevenueViewService";
import ActionViewService from "../services/view/ActionViewService";
import MeasureViewService from "../services/view/MeasureViewService";
import OrderViewService from "../services/view/OrderViewService";
import CandleViewService from "../services/view/CandleViewService";
import ColorHelperService from "../services/helper/ColorHelperService";
import OrderCloseViewService from "../services/view/OrderCloseViewService";
import SettingViewService from "../services/view/SettingViewService";
import NotifyViewService from "../services/view/NotifyViewService";
import OrderHideViewService from "../services/view/OrderHideViewService";

{
    provide(TYPES.errorService, () => new ErrorService());
    provide(TYPES.alertService, () => new AlertService());
    provide(TYPES.layoutService, () => new LayoutService());
    provide(TYPES.loggerService, () => new LoggerService());
    provide(TYPES.routerService, () => new RouterService());
    provide(TYPES.jwtService, () => new JwtService());
}

{
    provide(TYPES.colorHelperService, () => new ColorHelperService());
}

{
    provide(TYPES.actionViewService, () => new ActionViewService());
    provide(TYPES.revenueViewService, () => new RevenueViewService());
    provide(TYPES.reportViewService, () => new ReportViewService());
    provide(TYPES.measureViewService, () => new MeasureViewService());
    provide(TYPES.orderViewService, () => new OrderViewService());
    provide(TYPES.orderCloseViewService, () => new OrderCloseViewService());
    provide(TYPES.candleViewService, () => new CandleViewService());
    provide(TYPES.settingViewService, () => new SettingViewService());
    provide(TYPES.notifyViewService, () => new NotifyViewService());
    provide(TYPES.orderHideViewService, () => new OrderHideViewService());
}
