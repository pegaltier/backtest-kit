import { Container, Paper } from "@mui/material";
import {
    Breadcrumbs2,
    Breadcrumbs2Type,
    HtmlView,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    useAsyncAction,
    useSubject,
} from "react-declarative";
import { ioc } from "../../../../lib";
import sanitize from "../../../../config/sanitize";
import IconWrapper from "../../../../components/common/IconWrapper";
import { Download, KeyboardArrowLeft } from "@mui/icons-material";
import downloadHtml from "../../../../utils/downloadHtml";
import StrategyCalculatorWidget from "../../../../widgets/StrategyCalculatorWidget/StrategyCalculatorWidget";
import { Background } from "../../../../components/common/Background";

const options: IBreadcrumbs2Option[] = [
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: <KeyboardArrowLeft sx={{ display: "block" }} />,
    },
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "Дэшборд",
    },
    {
        type: Breadcrumbs2Type.Link,
        action: "back-action",
        label: "Калькулятор стратегии",
    },
];

const actions: IBreadcrumbs2Action[] = [
    {
        action: "download-action",
        label: "Скачать",
        icon: () => <IconWrapper icon={Download} color="#4caf50" />,
    },
];

export const CalculateView = () => {
    const downloadSubject = useSubject<void>();

    const handleAction = async (action: string) => {
        if (action === "back-action") {
            ioc.routerService.push("/dashboard");
        }
        if (action === "download-action") {
            await downloadSubject.next();
        }
    };

    return (
        <Container>
            <Breadcrumbs2
                items={options}
                actions={actions}
                onAction={handleAction}
            />
            <StrategyCalculatorWidget
                sx={{
                    height: "calc(100dvh - 165px)",
                }}
                downloadSubject={downloadSubject}
            />
            <Background />
        </Container>
    );
};

export default CalculateView;
