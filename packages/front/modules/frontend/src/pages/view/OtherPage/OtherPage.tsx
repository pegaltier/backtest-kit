import { IOutlet, IOutletProps, OutletView } from "react-declarative";
import hasRouteMatch from "../../../utils/hasRouteMatch";
import OrderCloseView from "./view/OrderCloseView";
import AskChatView from "./view/AskChatView";
import { ioc } from "../../../lib";

const routes: IOutlet[] = [
    {
        id: "order_closed",
        element: OrderCloseView,
        isActive: (pathname) => hasRouteMatch(["/other/order_closed"], pathname),
        isAvailable: () => false,
    },
    {
        id: "ask_chat",
        element: AskChatView,
        isActive: (pathname) => hasRouteMatch(["/other/chat"], pathname),
        isAvailable: () => false,
    }
];

export const OtherPage = ({ payload }: IOutletProps) => (
    <OutletView
        history={ioc.routerService}
        onLoadStart={() => ioc.layoutService.setAppbarLoader(true)}
        onLoadEnd={() => ioc.layoutService.setAppbarLoader(false)}
        routes={routes}
        payload={payload}
    />
);

export default OtherPage;
