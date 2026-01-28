/* eslint-disable max-lines */
import { ISwitchItem, heavy } from "react-declarative";
import { createRedirect } from "../utils/createRedirect";
import getMainRoute from "../utils/getMainRoute";
import { ioc } from "../lib";
import ErrorPage from "../pages/base/ErrorPage";
import DashboardPage from "../pages/view/DashboardPage";
import OtherPage from "../pages/view/OtherPage";

export interface IRouteItem extends ISwitchItem {
    noHeader?: boolean;
}

export const baseRoutes: IRouteItem[] = [
    {
        path: "/error_page",
        noHeader: true,
        element: ErrorPage,
    },
];

const dashboardRoutes: IRouteItem[] = [
    {
        path: "/dashboard",
        element: DashboardPage,
    },
    {
        path: "/dashboard/admin_panel",
        element: DashboardPage,
    },
    {
        path: "/dashboard/news_brave",
        element: DashboardPage,
    },
    {
        path: "/dashboard/news_mastodon",
        element: DashboardPage,
    },
    {
        path: "/dashboard/long_range",
        element: DashboardPage,
    },
    {
        path: "/dashboard/swing_range",
        element: DashboardPage,
    },
    {
        path: "/dashboard/short_range",
        element: DashboardPage,
    },
    {
        path: "/dashboard/volume_data",
        element: DashboardPage,
    },
    {
        path: "/dashboard/strategy_report",
        element: DashboardPage,
    },
    {
        path: "/dashboard/license",
        element: DashboardPage,
    },
    {
        path: "/dashboard/calculate",
        element: DashboardPage,
    },
    {
        path: "/other/order_closed",
        element: OtherPage,
    },
    {
        path: "/other/chat",
        element: OtherPage,
    },
];

export const routes: IRouteItem[] = [
    {
        path: "/",
        element: createRedirect(async () => {
            ioc.routerService.push(await getMainRoute());
        }),
    },
    ...baseRoutes,
    ...dashboardRoutes,
];

export default routes;
