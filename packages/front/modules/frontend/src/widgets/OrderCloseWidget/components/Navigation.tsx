import {
    Breadcrumbs2,
    Breadcrumbs2Type,
    IBreadcrumbs2Option,
    IBreadcrumbs2Action,
} from "react-declarative";
import actionSubject from "../config/actionSubject";
import {
    KeyboardArrowLeft,
    Refresh,
    Settings,
} from "@mui/icons-material";
import IconWrapper from "../../../components/common/IconWrapper";

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
        label: "Сделки",
    },
];

const actions: IBreadcrumbs2Action[] = [
    {
        action: "update-now",
        label: "Обновить",
        icon: () => <IconWrapper icon={Refresh} color="#4caf50" />,
    },
    {
        action: "column-setup-action",
        label: "Настроить колонки",
        icon: () => <IconWrapper icon={Settings} color="#4caf50" />,
    },
];

export const Navigation = () => (
    <Breadcrumbs2
        items={options}
        actions={actions}
        onAction={actionSubject.next}
    />
);

export default Navigation;
