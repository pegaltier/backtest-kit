import { IOutlet, IOutletProps, OutletView } from "react-declarative";
import hasRouteMatch from "../../../utils/hasRouteMatch";

import MainPage from "./view/MainPage";
import { ioc } from "../../../lib";
import NewsBraveView from "./view/NewsBraveView";
import NewsMastodonView from "./view/NewsMastodonView";
import LongRangeView from "./view/LongRangeView";
import SwingRangeView from "./view/SwingRangeView";
import ShortRangeView from "./view/ShortRangeView";
import StrategyReportView from "./view/StrategyReportView";
import RevenueView from "./view/RevenueView";
import VolumeDataView from "./view/VolumeDataView";
import LicenseView from "./view/LicenseView";
import CalculateView from "./view/CalculateView";

const routes: IOutlet[] = [
    {
        id: "dashboard",
        element: MainPage,
        isActive: (pathname) => hasRouteMatch(["/dashboard"], pathname),
        isAvailable: () => false,
    },
    {
        id: "admin_panel",
        element: RevenueView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/admin_panel"], pathname),
        isAvailable: () => false,
    },
    {
        id: "news_brave",
        element: NewsBraveView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/news_brave"], pathname),
        isAvailable: () => false,
    },
    {
        id: "news_mastodon",
        element: NewsMastodonView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/news_mastodon"], pathname),
        isAvailable: () => false,
    },
    {
        id: "long_range",
        element: LongRangeView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/long_range"], pathname),
        isAvailable: () => false,
    },
    {
        id: "swing_range",
        element: SwingRangeView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/swing_range"], pathname),
        isAvailable: () => false,
    },
    {
        id: "short_range",
        element: ShortRangeView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/short_range"], pathname),
        isAvailable: () => false,
    },
    {
        id: "volume_data",
        element: VolumeDataView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/volume_data"], pathname),
        isAvailable: () => false,
    },
    {
        id: "license_data",
        element: LicenseView,
        isActive: (pathname) => hasRouteMatch(["/dashboard/license"], pathname),
        isAvailable: () => false,
    },
    {
        id: "calculate_data",
        element: CalculateView,
        isActive: (pathname) => hasRouteMatch(["/dashboard/calculate"], pathname),
        isAvailable: () => false,
    },
    {
        id: "strategy_report",
        element: StrategyReportView,
        isActive: (pathname) =>
            hasRouteMatch(["/dashboard/strategy_report"], pathname),
        isAvailable: () => false,
    },
];

export const DashboardPage = ({ payload }: IOutletProps) => (
    <OutletView
        history={ioc.routerService}
        onLoadStart={() => ioc.layoutService.setAppbarLoader(true)}
        onLoadEnd={() => ioc.layoutService.setAppbarLoader(false)}
        routes={routes}
        payload={payload}
    />
);

export default DashboardPage;
