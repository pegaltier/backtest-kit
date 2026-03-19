import { IOutlet, OutletView } from "react-declarative";
import hasRouteMatch from "../../../utils/hasRouteMatch";

import MainView from "./view/MainView";
import CoinView from "./view/CoinView";
import ChartView from "./view/ChartView";
import ioc from "../../../lib";

const routes: IOutlet[] = [
    {
        id: "chart",
        element: ChartView,
        isActive: (pathname) => hasRouteMatch(["/price_chart/:symbol/:interval"], pathname),
    },
    {
        id: "coin",
        element: CoinView,
        isActive: (pathname) => hasRouteMatch(["/price_chart/:symbol"], pathname),
    },
    {
        id: "main",
        element: MainView,
        isActive: (pathname) => hasRouteMatch(["/price_chart"], pathname),
    },
];

interface IPriceChartPageProps {
    symbol: string;
    interval: string;
}

export const PriceChartPage = ({ symbol, interval }: IPriceChartPageProps) => (
    <OutletView
        history={ioc.routerService}
        onLoadStart={() => ioc.layoutService.setAppbarLoader(true)}
        onLoadEnd={() => ioc.layoutService.setAppbarLoader(false)}
        routes={routes}
        params={{ symbol, interval }}
    />
);

export default PriceChartPage;
