/* eslint-disable max-lines */
import { ISwitchItem, heavy } from "react-declarative";
import { createRedirect } from "../utils/createRedirect";
import getMainRoute from "../utils/getMainRoute";
import { ioc } from "../lib";
import ErrorPage from "../pages/base/ErrorPage";
import { HourglassTop, LiveTv } from "@mui/icons-material";

export interface IRouteItem extends ISwitchItem {
    noHeader?: boolean;
    tabs?: ITab[];
}

export interface ITab {
    path: string;
    label: string;
    icon?: React.ComponentType<any>;
    visible?: boolean;
    disabled?: boolean;
    active: boolean;
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
        path: "/main",
        element: heavy(() => import("../pages/view/MainPage")),
    },
    {
        path: "/overview",
        element: heavy(() => import("../pages/view/OverviewPage")),
    },
    {
        path: "/dashboard",
        tabs: [
            {
                label: "Backtest Measures",
                active: true,
                icon: HourglassTop,
                path: "/dashboard/backtest",
            },
            {
                label: "Live Measures",
                active: false,
                icon: LiveTv,
                path: "/dashboard/live",
            }
        ],
        element: heavy(() => import("../pages/view/DashboardPage")),
    },
    {
        path: "/dashboard/backtest",
        tabs: [
            {
                label: "Backtest Measures",
                active: true,
                icon: HourglassTop,
                path: "/dashboard/backtest",
            },
            {
                label: "Live Measures",
                active: false,
                icon: LiveTv,
                path: "/dashboard/live",
            }
        ],
        element: heavy(() => import("../pages/view/DashboardPage")),
    },
    {
        path: "/dashboard/live",
        tabs: [
            {
                label: "Backtest Measures",
                active: false,
                icon: HourglassTop,
                path: "/dashboard/backtest",
            },
            {
                label: "Live Measures",
                active: true,
                icon: LiveTv,
                path: "/dashboard/live",
            }
        ],
        element: heavy(() => import("../pages/view/DashboardPage")),
    },
    {
        path: "/notifications",
        element: heavy(() => import("../pages/view/NotificationPage")),
    },
    {
        path: "/logs",
        element: heavy(() => import("../pages/view/LogPage")),
    },
    {
        path: "/status",
        element: heavy(() => import("../pages/view/StatusPage")),
    },
    {
        path: "/status/:id",
        element: heavy(() => import("../pages/view/StatusPage")),
    },
    {
        path: "/report",
        element: heavy(() => import("../pages/view/ReportPage")),
    },
    {
        path: "/dump",
        element: heavy(() => import("../pages/view/DumpPage")),
    },
    {
        path: "/dump/:search",
        element: heavy(() => import("../pages/view/DumpPage")),
    },
    {
        path: "/heat",
        element: heavy(() => import("../pages/view/HeatPage")),
    },
    {
        path: "/price_chart",
        element: heavy(() => import("../pages/view/PriceChartPage")),
    },
    {
        path: "/price_chart/:symbol",
        element: heavy(() => import("../pages/view/PriceChartPage")),
    },
    {
        path: "/price_chart/:symbol/:interval",
        element: heavy(() => import("../pages/view/PriceChartPage")),
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
