import {
    IOutlet,
    ITabsStep,
    TabsView,
    History,
    useOnce,
} from "react-declarative";
import Navigation from "./components/Navigation";
import ClosedView from "./view/ClosedView";
import RemovedView from "./view/RemovedView";
import { ioc } from "../../lib";
import { createMemoryHistory } from "history";
import { Background } from "../../components/common/Background";

const history = createMemoryHistory();

const hasMatch = (templates: string[], pathname: string) => {
    return templates.some((template) => template.includes(pathname));
};

const routes: IOutlet[] = [
    {
        id: "closed",
        element: ClosedView,
        isActive: (pathname) => hasMatch(["/order_close/closed"], pathname),
    },
    {
        id: "removed",
        element: RemovedView,
        isActive: (pathname) => hasMatch(["/order_close/removed"], pathname),
    },
];

const tabs: ITabsStep[] = [
    {
        id: "closed",
        label: "Закрытые сделки",
    },
    {
        id: "removed",
        label: "Удаленные сделки",
    },
];

export const OrderCloseWidget = () => {
    useOnce(() => history.replace("/order_close/closed"));

    const handleTabChange = (id: string, history: History) => {
        if (id === "closed") {
            history.replace(`/order_close/closed`);
        }
        if (id === "removed") {
            history.replace(`/order_close/removed`);
        }
    };

    return (
        <>
            <TabsView
                withScroll
                sx={{
                    height: "calc(100vh - 125px)",
                }}
                BeforePaper={Navigation}
                onLoadStart={() => ioc.layoutService.setAppbarLoader(true)}
                onLoadEnd={() => ioc.layoutService.setAppbarLoader(false)}
                routes={routes}
                tabs={tabs}
                history={history}
                onTabChange={handleTabChange}
            />
            <Background />
        </>
    );
};

export default OrderCloseWidget;
