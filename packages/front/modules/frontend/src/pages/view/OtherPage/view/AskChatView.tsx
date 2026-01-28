import { KeyboardArrowLeft, Refresh } from "@mui/icons-material";
import {
    Breadcrumbs2,
    Breadcrumbs2Type,
    IBreadcrumbs2Action,
    IBreadcrumbs2Option,
    useReloadTrigger,
} from "react-declarative";
import IconWrapper from "../../../../components/common/IconWrapper";
import { Container } from "@mui/material";
import ChatWidget from "../../../../widgets/ChatWidget";
import { ioc } from "../../../../lib";

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
        label: "ИИ Чат",
    },
];

const actions: IBreadcrumbs2Action[] = [
    {
        action: "reload-action",
        icon: () => <IconWrapper icon={Refresh} color="#4caf50" />,
        label: "Создать новый чат",
    },
];

export const AskChatView = () => {
    const handleAction = async (action: string) => {
        if (action === "back-action") {
            ioc.routerService.push("/dashboard");
        }
        if (action === "reload-action") {
            ioc.layoutService.reloadOutlet();
        }
    };

    return (
        <Container>
            <Breadcrumbs2
                items={options}
                actions={actions}
                onAction={handleAction}
            />
            <ChatWidget />
        </Container>
    );
};

export default AskChatView;
