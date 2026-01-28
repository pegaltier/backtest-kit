import { Settings } from "@mui/icons-material";
import {
    FieldType,
    OneIcon,
    TypedField,
    useActualState,
    useActualValue,
    useAsyncAction,
    useLocalHandler,
    usePrompt,
    useSubject,
} from "react-declarative";
import { ioc } from "../../lib";

const ADMIN_PASS = "88888888";

const fields: TypedField[] = [
    {
        type: FieldType.Box,
        fields: [
            {
                type: FieldType.Typography,
                typoVariant: "h6",
                placeholder: "Настройки системы",
            },
            {
                type: FieldType.Switch,
                fieldRightMargin: "0",
                name: "isBackgroundTradeEnabled",
                title: "Включить автоторговлю",
            },
            {
                type: FieldType.Button,
                fieldBottomMargin: "0",
                fieldRightMargin: "0",
                buttonVariant: "contained",
                click: async ({}, {}, data, { handleSave }) => {
                    await handleSave(data);
                },
                name: "save-button",
                title: "Применить",
            },
        ],
    },
];

export const AppSettings = () => {
    const reloadSubject = useSubject<void>();
    const closeSubject = useSubject<void>();

    const pickPrompt = usePrompt({
        title: "Пароль администратора",
        inputType: "password",
    });

    const { execute: handler } = useAsyncAction(
        async () => {
            return await ioc.settingViewService.getValue();
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const { execute } = useAsyncAction(
        async (data: Record<string, unknown>) => {
            await ioc.settingViewService.setValue(data);
            ioc.alertService.notify("Настройки применены успешно!");
            closeSubject.next();
        },
        {
            onLoadStart: () => ioc.layoutService.setAppbarLoader(true),
            onLoadEnd: () => ioc.layoutService.setAppbarLoader(false),
        },
    );

    const handleSave = async (data: Record<string, unknown>) => {
        const confirm = await pickPrompt().toPromise();
        if (confirm === ADMIN_PASS) {
            await execute(data);
            return;
        }
        ioc.alertService.notify("Неверный пароль");
    };

    return (
        <OneIcon
            closeSubject={closeSubject}
            reloadSubject={reloadSubject}
            onClose={reloadSubject.next}
            payload={() => ({ handleSave })}
            noBadge
            fields={fields}
            handler={handler}
        >
            <Settings sx={{ color: "white" }} />
        </OneIcon>
    );
};

export default AppSettings;
