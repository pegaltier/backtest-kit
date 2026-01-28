import { SxProps } from "@mui/material";
import { IWizardOutlet, IWizardStep, LoaderView, parseRouteUrl, TSubject, useAsyncValue, WizardView } from "react-declarative";
import PriceView from "./view/PriceView";
import AmountView from "./view/AmountView";
import ReportView from "./view/ReportView";
import { ioc } from "../../lib";

const LOADER_SIZE = 48;

interface IStrategyCalculatorWidgetProps {
    sx?: SxProps;
    downloadSubject: TSubject<void>;
}

const INITIAL_PATH = "/price";

const steps: IWizardStep[] = [
    {
        id: "price",
        label: "Цена",
    },
    {
        id: "amount",
        label: "Шаг",
    },
    {
        id: "report",
        label: "Отчет",
    },
];

const routes: IWizardOutlet[] = [
    {
        id: "price",
        element: PriceView,
        isActive: (pathname) => !!parseRouteUrl("/price", pathname),
    },
    {
        id: "amount",
        element: AmountView,
        isActive: (pathname) => !!parseRouteUrl("/amount", pathname),
    },
    {
        id: "report",
        element: ReportView,
        isActive: (pathname) => !!parseRouteUrl("/report", pathname),
    },
];

export const StrategyCalculatorWidget = ({
    sx,
    downloadSubject,
}: IStrategyCalculatorWidgetProps) => {

    const [closePrice, { loading }] = useAsyncValue(async () => {
        return await ioc.revenueViewService.getLastClosePrice();
    }, {
        onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
        onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
    })

    if (!closePrice || loading) {
        return (
            <LoaderView
                sx={sx}
                size={LOADER_SIZE}
            />
        )
    }

    return (
        <WizardView
            sx={sx}
            pathname={INITIAL_PATH}
            initialData={{
                price: null,
                amount: null,
                report: {},
            }}
            payload={() => ({
                downloadSubject,
                closePrice,
            })}
            steps={steps}
            routes={routes}
        />
    );
};

export default StrategyCalculatorWidget;
