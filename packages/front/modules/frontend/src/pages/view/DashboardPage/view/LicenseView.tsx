import { Container, Paper } from "@mui/material";
import {
    Breadcrumbs2,
    Breadcrumbs2Type,
    HtmlView,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    useAsyncAction,
} from "react-declarative";
import { ioc } from "../../../../lib";
import sanitize from "../../../../config/sanitize";
import IconWrapper from "../../../../components/common/IconWrapper";
import { Download, KeyboardArrowLeft } from "@mui/icons-material";
import downloadHtml from "../../../../utils/downloadHtml";

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
        label: "Лицензионное соглашение",
    },
];

const actions: IBreadcrumbs2Action[] = [
    {
        action: "download-action",
        label: "Скачать",
        icon: () => <IconWrapper icon={Download} color="#4caf50" />,
    },
];

export const LicenseView = () => {
    const { execute: handleDownload } = useAsyncAction(
        async () => {
            const response = await fetch("/license.html");
            const html = await response.text();
            await downloadHtml(html);
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const handleAction = async (action: string) => {
        if (action === "back-action") {
            ioc.routerService.push("/dashboard");
        }
        if (action === "download-action") {
            await handleDownload();
        }
    };

    return (
        <Container>
            <Breadcrumbs2
                items={options}
                actions={actions}
                onAction={handleAction}
            />
            <HtmlView
                component={Paper}
                sx={{
                    height: "calc(100dvh - 200px)",
                    overflowY: "auto",
                    overflowX: "hidden",
                    paddingTop: "12px",
                    paddingBottom: "12px",
                    paddingLeft: "8px",
                    paddingRight: "8px",
                }}
                config={sanitize}
                handler={async () => {
                    const response = await fetch("/license.html");
                    return await response.text();
                }}
            />
        </Container>
    );
};

export default LicenseView;
